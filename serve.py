"""本地预览服务器：比 python -m http.server 多一件事——禁用缓存。

浏览器会缓存 app.js / layout.css，改完代码看不到效果，很容易误判成 bug。
这里给每个响应加 no-store，改完刷新就生效。
"""
import functools
import http.server
import os
import socketserver
import sys

# 端口可以指定：python serve.py 8132
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8131
ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def log_message(self, *args):
        pass  # 别刷屏


class Server(socketserver.ThreadingTCPServer):
    # 页面会一次要几十个 JSON（搜索、归档），单线程会被自己人堵住
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    with Server(("0.0.0.0", PORT), handler) as httpd:
        print(f"本机：http://127.0.0.1:{PORT}/")
        print(f"同 WiFi 的设备：http://<你的内网 IP>:{PORT}/   （Ctrl+C 结束）")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
