import http.server
import socketserver
import threading
import json
import subprocess
import os
import sys
import tempfile
import time

PORT = 8085
result_data = None
server_done = threading.Event()

class TestServerHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        global result_data
        if self.path == '/report_result':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                result_data = json.loads(body)
            except Exception as e:
                result_data = {'passed': False, 'error': str(e), 'raw': body}
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
            server_done.set()
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Silence normal HTTP access logs
        pass

def find_browser():
    paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    ]
    for p in paths:
        if os.path.exists(p):
            return p
    return None

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    browser = find_browser()
    if not browser:
        print("Error: No browser found on system")
        sys.exit(1)

    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("", PORT), TestServerHandler)
    server_thread = threading.Thread(target=httpd.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    print(f"Test server running on port {PORT}")

    temp_dir = tempfile.mkdtemp()
    target_test = sys.argv[1] if len(sys.argv) > 1 else "test_phase10.html"
    test_url = f"http://localhost:{PORT}/{target_test}"

    cmd = [
        browser,
        "--headless=new",
        "--disable-gpu",
        f"--user-data-dir={temp_dir}",
        "--no-first-run",
        test_url
    ]

    print("Launching browser for Phase 10 E2E tests...")
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    finished = server_done.wait(timeout=20)
    try:
        proc.terminate()
        proc.wait(timeout=2)
    except Exception:
        pass

    httpd.shutdown()
    httpd.server_close()

    print("\n================== PHASE 10 E2E TEST RESULT ==================")
    if not finished or result_data is None:
        print("ERROR: Test run timed out or produced no result!")
        sys.exit(1)

    print(json.dumps(result_data, indent=2))
    if result_data.get('passed'):
        print(f"\nSUCCESS: {result_data.get('passedTests')}/{result_data.get('total')} tests PASSED!")
        sys.exit(0)
    else:
        print(f"\nFAILED: {result_data.get('error', 'Some tests failed')}")
        if 'stack' in result_data:
            print(result_data['stack'])
        sys.exit(1)

if __name__ == '__main__':
    main()
