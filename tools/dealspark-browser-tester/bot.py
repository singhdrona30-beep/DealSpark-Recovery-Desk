"""
DealSpark Browser Tester
Real headed-browser checks for Google/Bing visibility and owned-store page navigation.
Search-result click-through is deliberately limited to one verification click per
keyword per session; repeat cycles re-check visibility and directly test product URLs.
"""
import csv, json, queue, threading, time, tkinter as tk
from tkinter import ttk, messagebox
from datetime import datetime
from pathlib import Path
from urllib.parse import quote_plus, urlparse
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

STORE = "https://dealspark-store.myshopify.com/"
OUT = Path(__file__).resolve().parent / "results"
OUT.mkdir(exist_ok=True)

DEFAULT_KEYWORDS = """DealSpark
DealSpark home products
DealSpark pet products
DealSpark dog sweaters
DealSpark travel accessories"""

def host_is_store(url):
    try:
        host = (urlparse(url).hostname or "").lower()
        return host == "dealspark-store.myshopify.com" or host.endswith(".myshopify.com")
    except Exception:
        return False

class App:
    def __init__(self, root):
        self.root = root
        root.title("DealSpark Browser Tester")
        root.geometry("820x700")
        self.events = queue.Queue()
        self.stop_event = threading.Event()
        self.worker = None
        self.clicks_done = set()
        self._ui()
        root.after(150, self._drain)

    def _ui(self):
        pad = {"padx": 10, "pady": 5}
        ttk.Label(self.root, text="DealSpark Google + Bing Browser Tester",
                  font=("Segoe UI", 16, "bold")).pack(anchor="w", **pad)
        ttk.Label(self.root, text="Searches real result pages, records DealSpark's position, "
                  "and tests store/product pages in a visible browser.").pack(anchor="w", **pad)

        opts = ttk.Frame(self.root); opts.pack(fill="x", **pad)
        self.google = tk.BooleanVar(value=True); self.bing = tk.BooleanVar(value=True)
        ttk.Checkbutton(opts, text="Google", variable=self.google).pack(side="left", padx=8)
        ttk.Checkbutton(opts, text="Bing", variable=self.bing).pack(side="left", padx=8)
        ttk.Label(opts, text="Repeat cycles (1–20):").pack(side="left", padx=(20, 5))
        self.cycles = tk.IntVar(value=1)
        ttk.Spinbox(opts, from_=1, to=20, width=5, textvariable=self.cycles).pack(side="left")
        ttk.Label(opts, text="Pause between searches (seconds):").pack(side="left", padx=(20, 5))
        self.pause = tk.IntVar(value=8)
        ttk.Spinbox(opts, from_=5, to=60, width=5, textvariable=self.pause).pack(side="left")

        ttk.Label(self.root, text="Search keywords (one per line):").pack(anchor="w", **pad)
        self.keywords = tk.Text(self.root, height=7, wrap="word")
        self.keywords.pack(fill="x", padx=10)
        self.keywords.insert("1.0", DEFAULT_KEYWORDS)

        ttk.Label(self.root, text="Product URLs to test (one per line; optional):").pack(anchor="w", **pad)
        self.urls = tk.Text(self.root, height=5, wrap="word")
        self.urls.pack(fill="x", padx=10)
        self.urls.insert("1.0", STORE)

        controls = ttk.Frame(self.root); controls.pack(fill="x", **pad)
        self.start_btn = ttk.Button(controls, text="Start browser test", command=self.start)
        self.start_btn.pack(side="left", padx=5)
        self.stop_btn = ttk.Button(controls, text="Stop", command=self.stop, state="disabled")
        self.stop_btn.pack(side="left", padx=5)
        ttk.Button(controls, text="Open results folder", command=self.open_results).pack(side="left", padx=5)

        ttk.Label(self.root, text="Activity log:").pack(anchor="w", **pad)
        self.log = tk.Text(self.root, height=18, state="disabled", wrap="word")
        self.log.pack(fill="both", expand=True, padx=10, pady=(0, 10))

    def say(self, msg):
        self.events.put(msg)

    def _drain(self):
        while not self.events.empty():
            msg = self.events.get()
            self.log.configure(state="normal")
            self.log.insert("end", msg + "\n")
            self.log.see("end")
            self.log.configure(state="disabled")
        self.root.after(150, self._drain)

    def start(self):
        if self.worker and self.worker.is_alive():
            return
        engines = []
        if self.google.get(): engines.append("Google")
        if self.bing.get(): engines.append("Bing")
        if not engines:
            messagebox.showwarning("Choose a search engine", "Select Google, Bing, or both.")
            return
        terms = [x.strip() for x in self.keywords.get("1.0", "end").splitlines() if x.strip()]
        urls = [x.strip() for x in self.urls.get("1.0", "end").splitlines()
                if x.strip().startswith(("https://", "http://"))]
        if not terms:
            messagebox.showwarning("Missing keywords", "Enter at least one search keyword.")
            return
        try:
            cycles = max(1, min(20, int(self.cycles.get())))
            delay = max(5, min(60, int(self.pause.get())))
        except Exception:
            messagebox.showerror("Invalid settings", "Repeat and pause must be whole numbers.")
            return
        self.stop_event.clear()
        self.clicks_done.clear()
        self.start_btn.configure(state="disabled"); self.stop_btn.configure(state="normal")
        self.worker = threading.Thread(target=self.run, args=(engines, terms, urls, cycles, delay), daemon=True)
        self.worker.start()

    def stop(self):
        self.stop_event.set()
        self.say("Stop requested. Finishing the current page safely…")

    def open_results(self):
        import os, subprocess, sys
        if sys.platform.startswith("win"): os.startfile(str(OUT))
        elif sys.platform == "darwin": subprocess.Popen(["open", str(OUT)])
        else: subprocess.Popen(["xdg-open", str(OUT)])

    def record(self, writer, row):
        writer.writerow(row)

    def run(self, engines, terms, urls, cycles, delay):
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        csv_path = OUT / f"dealspark-test-{stamp}.csv"
        fields = ["time","cycle","engine","keyword","found","position","result_url","page_test","notes"]
        try:
            with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.DictWriter(f, fieldnames=fields); writer.writeheader()
                with sync_playwright() as p:
                    browser = p.chromium.launch(headless=False)
                    context = browser.new_context(viewport={"width": 1365, "height": 900})
                    page = context.new_page()
                    for cycle in range(1, cycles + 1):
                        for engine in engines:
                            for term in terms:
                                if self.stop_event.is_set(): break
                                base = "https://www.google.com/search?q=" if engine == "Google" else "https://www.bing.com/search?q="
                                search_url = base + quote_plus(term)
                                self.say(f"[Cycle {cycle}/{cycles}] {engine}: {term}")
                                found = False; pos = ""; result_url = ""; notes = ""
                                try:
                                    page.goto(search_url, wait_until="domcontentloaded", timeout=45000)
                                    page.wait_for_timeout(2500)
                                    links = page.locator("a").all()
                                    rank = 0
                                    for link in links:
                                        try:
                                            href = link.get_attribute("href") or ""
                                            txt = (link.inner_text(timeout=700) or "").strip()
                                            if not href.startswith("http") or not txt: continue
                                            if host_is_store(href):
                                                rank += 1
                                                found = True; pos = str(rank); result_url = href
                                                break
                                        except Exception:
                                            continue
                                    if found:
                                        self.say(f"  FOUND DealSpark result (result-link #{pos}): {result_url}")
                                        # One real click-through per keyword+engine in this run, strictly for link QA.
                                        click_key = (engine, term.lower())
                                        if click_key not in self.clicks_done:
                                            self.clicks_done.add(click_key)
                                            try:
                                                page.goto(result_url, wait_until="domcontentloaded", timeout=45000)
                                                page.wait_for_timeout(1800)
                                                title = page.title()
                                                self.say(f"  Opened result successfully: {title[:100]}")
                                                notes = "One-time result click-through verified"
                                            except Exception as e:
                                                notes = "Result click/open failed: " + str(e)[:160]
                                                self.say("  Could not open result: " + str(e)[:120])
                                    else:
                                        self.say("  DealSpark store result not detected in loaded results.")
                                        notes = "Not detected in visible result links; search pages can vary by location/personalization."
                                    self.record(writer, {"time":datetime.now().isoformat(timespec="seconds"),
                                        "cycle":cycle,"engine":engine,"keyword":term,"found":found,
                                        "position":pos,"result_url":result_url,"page_test":"","notes":notes})
                                    f.flush()
                                except Exception as e:
                                    self.say(f"  Search error: {str(e)[:180]}")
                                    self.record(writer, {"time":datetime.now().isoformat(timespec="seconds"),
                                        "cycle":cycle,"engine":engine,"keyword":term,"found":False,
                                        "position":"","result_url":"","page_test":"","notes":str(e)[:180]})
                                    f.flush()
                                if self.stop_event.wait(delay): break
                            if self.stop_event.is_set(): break
                        if self.stop_event.is_set(): break
                    # Test the supplied store/product pages directly; repeat each cycle as a page-load QA check.
                    for cycle in range(1, cycles + 1):
                        for url in urls:
                            if self.stop_event.is_set(): break
                            self.say(f"[Cycle {cycle}/{cycles}] Opening page for load test: {url}")
                            try:
                                page.goto(url, wait_until="domcontentloaded", timeout=45000)
                                page.wait_for_timeout(1200)
                                title = page.title()
                                status = "loaded" if page.locator("body").count() else "no body"
                                self.say(f"  Page {status}: {title[:100]}")
                                self.record(writer, {"time":datetime.now().isoformat(timespec="seconds"),
                                    "cycle":cycle,"engine":"Direct page test","keyword":"","found":"",
                                    "position":"","result_url":url,"page_test":status,"notes":title[:160]})
                                f.flush()
                            except Exception as e:
                                self.say(f"  Page test failed: {str(e)[:150]}")
                                self.record(writer, {"time":datetime.now().isoformat(timespec="seconds"),
                                    "cycle":cycle,"engine":"Direct page test","keyword":"","found":"",
                                    "position":"","result_url":url,"page_test":"failed","notes":str(e)[:160]})
                                f.flush()
                        if self.stop_event.is_set(): break
                    context.close(); browser.close()
            self.say(f"Finished. CSV report saved: {csv_path}")
        except Exception as e:
            self.say("Bot stopped with error: " + str(e)[:240])
        finally:
            self.root.after(0, lambda: self.start_btn.configure(state="normal"))
            self.root.after(0, lambda: self.stop_btn.configure(state="disabled"))

if __name__ == "__main__":
    root = tk.Tk()
    App(root)
    root.mainloop()
