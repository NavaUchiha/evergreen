#!/usr/bin/env bash
# Import a Markdown file into the Evergreen backend as a concept.
# Usage: ./import-concept.sh <file.md> [tag1,tag2,...]
# Token: reads $EVERGREEN_TOKEN, or ~/.evergreen-token.
set -euo pipefail

API="${EVERGREEN_API:-https://140.245.228.37.sslip.io/api}"
FILE="${1:?path to a .md file required}"
TAGS="${2:-}"
TOKEN="${EVERGREEN_TOKEN:-$(cat ~/.evergreen-token 2>/dev/null || true)}"
[[ -n "$TOKEN" ]] || { echo "no token: set EVERGREEN_TOKEN or write ~/.evergreen-token" >&2; exit 1; }
[[ -f "$FILE" ]] || { echo "no such file: $FILE" >&2; exit 1; }

python3 - "$FILE" "$TAGS" "$API" "$TOKEN" <<'PY'
import json,sys,re,os,urllib.request
path,tags,api,tok=sys.argv[1:5]
body=open(path).read()
m=re.search(r'^\s*#\s+(.+)$', body, re.M)
title=(m.group(1).strip() if m else os.path.splitext(os.path.basename(path))[0])
slug=os.path.splitext(os.path.basename(path))[0]
payload={"title":title,"slug":slug,"body":body,
  "tags":[t.strip() for t in tags.split(",") if t.strip()]}
req=urllib.request.Request(api+"/concepts",data=json.dumps(payload).encode(),
  method="POST",headers={"Content-Type":"application/json","Authorization":"Bearer "+tok})
try:
  d=json.load(urllib.request.urlopen(req))
  print("imported:",d["slug"],"|",d["title"])
except urllib.error.HTTPError as e:
  print("error",e.code,e.read().decode()); sys.exit(1)
PY
