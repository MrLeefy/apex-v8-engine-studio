import json, urllib.request

JFKEY = "6698ae2cb2894c01bd5c8bb17a1807a1"

# Get kids movies library
# First find the kids movies library ID
libs = json.loads(urllib.request.urlopen(f"http://localhost:8096/Library/VirtualFolders?api_key={JFKEY}").read())
kids_lib = None
for lib in libs:
    if 'kid' in lib['Name'].lower():
        kids_lib = lib
        print(f"Found: {lib['Name']} (ID: {lib.get('ItemId')})")

# Get all movies across ALL libraries to find kids content
all_movies = []
start = 0
while True:
    url = f"http://localhost:8096/Items?api_key={JFKEY}&IncludeItemTypes=Movie&Recursive=true&Fields=Path,ProductionYear&StartIndex={start}&Limit=500"
    data = json.loads(urllib.request.urlopen(url).read())
    items = data.get("Items", [])
    all_movies.extend(items)
    if len(items) < 500:
        break
    start += 500

# Categorize
kids = []
teens = []
adults = []
for m in all_movies:
    path = m.get("Path", "")
    name = m.get("Name", "")
    year = m.get("ProductionYear", "?")
    if "kids-movies" in path:
        kids.append(f"{name} ({year})")
    elif "teens-movies" in path:
        teens.append(f"{name} ({year})")
    elif "adults-movies" in path:
        adults.append(f"{name} ({year})")

print(f"\nKids Movies: {len(kids)}")
print(f"Teens Movies: {len(teens)}")
print(f"Adults Movies: {len(adults)}")

print("\n=== KIDS MOVIES ===")
for m in sorted(kids):
    print(f"  {m}")

print("\n=== TEENS MOVIES (subset) ===")
for m in sorted(teens)[:50]:
    print(f"  {m}")
print(f"  ... {len(teens)} total")
