from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import re


class RangeHandler(SimpleHTTPRequestHandler):
    range_re = re.compile(r"bytes=(\d*)-(\d*)$")

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_head(self):
        path = self.translate_path(self.path)
        file_path = Path(path)

        if file_path.is_dir():
            return super().send_head()

        if not file_path.exists():
            self.send_error(404, "File not found")
            return None

        ctype = self.guess_type(path)
        file_obj = open(path, "rb")
        fs = os.fstat(file_obj.fileno())
        size = fs.st_size
        range_header = self.headers.get("Range")

        if not range_header:
          self.send_response(200)
          self.send_header("Content-type", ctype)
          self.send_header("Content-Length", str(size))
          self.send_header("Accept-Ranges", "bytes")
          self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
          self.end_headers()
          return file_obj

        match = self.range_re.match(range_header.strip())
        if not match:
            self.send_error(416, "Invalid range")
            file_obj.close()
            return None

        start_text, end_text = match.groups()
        start = int(start_text) if start_text else 0
        end = int(end_text) if end_text else size - 1

        if start > end or end >= size:
            self.send_error(416, "Requested range not satisfiable")
            file_obj.close()
            return None

        self.send_response(206)
        self.send_header("Content-type", ctype)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
        self.end_headers()
        file_obj.seek(start)
        self.range = (start, end)
        return file_obj

    def copyfile(self, source, outputfile):
        if not hasattr(self, "range"):
            return super().copyfile(source, outputfile)

        start, end = self.range
        remaining = end - start + 1
        while remaining > 0:
            chunk = source.read(min(1024 * 1024, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)
        del self.range


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", 8060), RangeHandler)
    print("Range static server on http://0.0.0.0:8060")
    server.serve_forever()
