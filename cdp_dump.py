import subprocess
import os
import time
import urllib.request
import json
import socket
import re
import sys

# Ensure stdout uses UTF-8 or ignores encoding errors to prevent Windows terminal crash
sys.stdout.reconfigure(encoding='utf-8', errors='ignore') if hasattr(sys.stdout, 'reconfigure') else None

chrome_paths = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expanduser(r"~\AppData\Local\Google\Chrome\Application\chrome.exe")
]

chrome_path = None
for path in chrome_paths:
    if os.path.exists(path):
        chrome_path = path
        break

if not chrome_path:
    print("Chrome not found.")
    exit(1)

print("Found Chrome at:", chrome_path)

# Ensure user data dir exists
user_data_dir = r"C:\Users\user\.gemini\antigravity\scratch\chrome_profile_cdp"
os.makedirs(user_data_dir, exist_ok=True)

# Start Chrome in headless mode with remote debugging port 9222
target_url = "https://gemini.google.com/share/7ce8e2d11e4d"
chrome_process = subprocess.Popen([
    chrome_path,
    "--headless",
    "--disable-gpu",
    f"--remote-debugging-port=9222",
    f"--user-data-dir={user_data_dir}",
    target_url
])

print("Launched Chrome process. Waiting 12 seconds for page to load and API requests to complete...")
time.sleep(12)

try:
    # Query http://127.0.0.1:9222/json to get the list of targets
    with urllib.request.urlopen("http://127.0.0.1:9222/json") as resp:
        targets = json.loads(resp.read().decode('utf-8'))
    
    print(f"Found {len(targets)} targets:")
    ws_url = None
    for t in targets:
        title = str(t.get('title')).encode('ascii', errors='ignore').decode('ascii')
        url_str = str(t.get('url'))
        ws = str(t.get('webSocketDebuggerUrl'))
        print(f"  Target: {title}, URL: {url_str}, WS: {ws}")
        if url_str.startswith("https://gemini.google.com/share/"):
            ws_url = t.get('webSocketDebuggerUrl')
            
    if not ws_url:
        print("Target tab not found. Using the first target.")
        for t in targets:
            if t.get('webSocketDebuggerUrl'):
                ws_url = t.get('webSocketDebuggerUrl')
                break

    if not ws_url:
        raise Exception("No WebSocket debugger URL found.")
        
    print("Connecting to WebSocket:", ws_url)
    ws_match = re.match(r'ws://([^/:]+):(\d+)(.+)', ws_url)
    if not ws_match:
        raise Exception("Invalid WS URL format: " + ws_url)
    
    host = ws_match.group(1)
    port = int(ws_match.group(2))
    path = ws_match.group(3)
    
    # Connect socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect((host, port))
    
    # Handshake
    handshake = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}:{port}\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
        f"Sec-WebSocket-Version: 13\r\n\r\n"
    )
    sock.sendall(handshake.encode('utf-8'))
    
    # Read response headers until double CRLF
    resp_headers = b""
    while b"\r\n\r\n" not in resp_headers:
        chunk = sock.recv(1024)
        if not chunk:
            break
        resp_headers += chunk
    
    print("Handshake response headers read.")
    
    # Helper to send text frame (CDP command)
    def send_cdp(cmd_id, method, params=None):
        payload = {"id": cmd_id, "method": method}
        if params:
            payload["params"] = params
        payload_bytes = json.dumps(payload).encode('utf-8')
        L = len(payload_bytes)
        
        frame = bytearray()
        frame.append(0x81)
        if L < 126:
            frame.append(0x80 | L)
        else:
            frame.append(0x80 | 126)
            frame.append((L >> 8) & 0xFF)
            frame.append(L & 0xFF)
        frame.extend([0, 0, 0, 0]) # 4-byte mask (zeros)
        frame.extend(payload_bytes)
        sock.sendall(frame)
        
    # Helper to receive one frame
    def recv_frame():
        head = sock.recv(2)
        if not head:
            return None
        opcode = head[0] & 0x0F
        masked = head[1] & 0x80
        length = head[1] & 0x7F
        if length == 126:
            length_bytes = sock.recv(2)
            length = (length_bytes[0] << 8) | length_bytes[1]
        elif length == 127:
            length_bytes = sock.recv(8)
            length = int.from_bytes(length_bytes, byteorder='big')
            
        if masked:
            mask = sock.recv(4)
            
        payload = bytearray()
        while len(payload) < length:
            chunk = sock.recv(length - len(payload))
            if not chunk:
                break
            payload.extend(chunk)
            
        if masked:
            for i in range(len(payload)):
                payload[i] ^= mask[i % 4]
        return payload.decode('utf-8', errors='ignore')

    # Enable Runtime
    send_cdp(1, "Runtime.enable")
    recv_frame() # consume response
    
    # Evaluate document.documentElement.outerHTML
    print("Evaluating document.documentElement.outerHTML...")
    send_cdp(2, "Runtime.evaluate", {
        "expression": "document.documentElement.outerHTML",
        "returnByValue": True
    })
    
    # Find the response matching id=2
    html_content = ""
    start_time = time.time()
    while time.time() - start_time < 5:
        frame = recv_frame()
        if not frame:
            break
        try:
            resp = json.loads(frame)
            if resp.get("id") == 2:
                result = resp.get("result", {})
                html_content = result.get("result", {}).get("value", "")
                break
        except Exception:
            pass

    print("CDP DOM length retrieved:", len(html_content))
    if html_content:
        with open("chrome_cdp_dom.html", "w", encoding="utf-8") as f:
            f.write(html_content)
        
        # Search for words
        for word in ["antidote", "video", "drive", "youtube", "alien", "rusting", "lava"]:
            count = html_content.lower().count(word)
            print(f"Keyword '{word}' count: {count}")
            
        # Search for links in CDP DOM
        drive_links = re.findall(r'https?://drive\.google\.com/[^\s"\'<>\\#]+', html_content)
        print("Drive links found in CDP DOM:", set(drive_links))
        youtube_links = re.findall(r'https?://(?:www\.)?youtube\.com/[^\s"\'<>\\#]+', html_content)
        print("YouTube links found in CDP DOM:", set(youtube_links))
        
        # Print vimeo/github
        other_links = re.findall(r'https?://[^\s"\'<>\\#]+', html_content)
        filtered_links = [u for u in other_links if not any(x in u for x in ['google.com', 'gstatic.com', 'googleapis.com', 'googletagmanager'])]
        print("Non-google links in CDP DOM:", set(filtered_links))

        # Check for any .mp4 / .webm file URL
        mp4_files = re.findall(r'https?://[^\s"\'<>\\#]+?\.(?:mp4|webm|ogg)', html_content, re.IGNORECASE)
        print("Raw video files found:", set(mp4_files))
        
        # Let's parse all human readable text inside DOM to find the video link or video description.
        # We can extract anything between tag boundaries (e.g. >text<)
        all_text = re.findall(r'>([^<>{}\n]+)<', html_content)
        all_text = [t.strip() for t in all_text if t.strip()]
        
        # Write clean texts to a file
        with open("chrome_cdp_text.txt", "w", encoding="utf-8") as f:
            for t in all_text:
                f.write(t + "\n")
                
        print("Extracted clean texts to chrome_cdp_text.txt. Searching for video description or URLs...")
        for t in all_text:
            if 'http' in t or 'drive' in t or 'video' in t or 'antidote' in t or 'play' in t:
                print("  Matched Text Line:", t[:200])

except Exception as e:
    print("CDP Error:", e)

finally:
    # Terminate Chrome
    chrome_process.terminate()
    print("Chrome terminated.")
