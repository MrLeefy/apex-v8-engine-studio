import json, urllib.request

JFKEY = "6698ae2cb2894c01bd5c8bb17a1807a1"

# Get ALL movies across ALL libraries
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

# Build a set of all movie titles (normalized) across all libraries
all_titles = set()
kids_titles = set()
teens_titles = set()

for m in all_movies:
    name = m.get("Name", "").lower().strip()
    year = m.get("ProductionYear", "")
    path = m.get("Path", "")
    key = f"{name}|{year}"
    all_titles.add(key)
    if "kids-movies" in path:
        kids_titles.add(key)
    elif "teens-movies" in path:
        teens_titles.add(key)

# === DISNEY ANIMATION STUDIOS CANON (62 films) ===
disney_animation = [
    ("Snow White and the Seven Dwarfs", 1937), ("Pinocchio", 1940), ("Fantasia", 1940),
    ("Dumbo", 1941), ("Bambi", 1942), ("Saludos Amigos", 1942), ("The Three Caballeros", 1944),
    ("Make Mine Music", 1946), ("Fun and Fancy Free", 1947), ("Melody Time", 1948),
    ("The Adventures of Ichabod and Mr. Toad", 1949), ("Cinderella", 1950), ("Alice in Wonderland", 1951),
    ("Peter Pan", 1953), ("Lady and the Tramp", 1955), ("Sleeping Beauty", 1959),
    ("One Hundred and One Dalmatians", 1961), ("The Sword in the Stone", 1963),
    ("The Jungle Book", 1967), ("The Aristocats", 1970), ("Robin Hood", 1973),
    ("The Many Adventures of Winnie the Pooh", 1977), ("The Rescuers", 1977),
    ("The Fox and the Hound", 1981), ("The Black Cauldron", 1985),
    ("The Great Mouse Detective", 1986), ("Oliver & Company", 1988),
    ("The Little Mermaid", 1989), ("The Rescuers Down Under", 1990),
    ("Beauty and the Beast", 1991), ("Aladdin", 1992), ("The Lion King", 1994),
    ("Pocahontas", 1995), ("The Hunchback of Notre Dame", 1996), ("Hercules", 1997),
    ("Mulan", 1998), ("Tarzan", 1999), ("Fantasia 2000", 1999),
    ("Dinosaur", 2000), ("The Emperor's New Groove", 2000), ("Atlantis: The Lost Empire", 2001),
    ("Lilo & Stitch", 2002), ("Treasure Planet", 2002), ("Brother Bear", 2003),
    ("Home on the Range", 2004), ("Chicken Little", 2005), ("Meet the Robinsons", 2007),
    ("Bolt", 2008), ("The Princess and the Frog", 2009), ("Tangled", 2010),
    ("Winnie the Pooh", 2011), ("Wreck-It Ralph", 2012), ("Frozen", 2013),
    ("Big Hero 6", 2014), ("Zootopia", 2016), ("Moana", 2016),
    ("Ralph Breaks the Internet", 2018), ("Frozen II", 2019), ("Raya and the Last Dragon", 2021),
    ("Encanto", 2021), ("Strange World", 2022), ("Wish", 2023),
]

# === PIXAR ===
pixar = [
    ("Toy Story", 1995), ("A Bug's Life", 1998), ("Toy Story 2", 1999),
    ("Monsters, Inc.", 2001), ("Finding Nemo", 2003), ("The Incredibles", 2004),
    ("Cars", 2006), ("Ratatouille", 2007), ("WALL-E", 2008), ("Up", 2009),
    ("Toy Story 3", 2010), ("Cars 2", 2011), ("Brave", 2012),
    ("Monsters University", 2013), ("Inside Out", 2015), ("The Good Dinosaur", 2015),
    ("Finding Dory", 2016), ("Cars 3", 2017), ("Coco", 2017),
    ("Incredibles 2", 2018), ("Toy Story 4", 2019), ("Onward", 2020),
    ("Soul", 2020), ("Luca", 2021), ("Turning Red", 2022),
    ("Lightyear", 2022), ("Elemental", 2023), ("Inside Out 2", 2024),
    ("Elio", 2025),
]

# === DREAMWORKS ANIMATION ===
dreamworks = [
    ("Antz", 1998), ("The Prince of Egypt", 1998), ("The Road to El Dorado", 2000),
    ("Shrek", 2001), ("Spirit: Stallion of the Cimarron", 2002), ("Shrek 2", 2004),
    ("Shark Tale", 2004), ("Madagascar", 2005), ("Over the Hedge", 2006),
    ("Shrek the Third", 2007), ("Bee Movie", 2007), ("Kung Fu Panda", 2008),
    ("Madagascar: Escape 2 Africa", 2008), ("Monsters vs. Aliens", 2009),
    ("How to Train Your Dragon", 2010), ("Shrek Forever After", 2010),
    ("Megamind", 2010), ("Kung Fu Panda 2", 2011), ("Puss in Boots", 2011),
    ("Madagascar 3: Europe's Most Wanted", 2012), ("Rise of the Guardians", 2012),
    ("The Croods", 2013), ("Turbo", 2013), ("Mr. Peabody & Sherman", 2014),
    ("How to Train Your Dragon 2", 2014), ("Penguins of Madagascar", 2014),
    ("Home", 2015), ("Kung Fu Panda 3", 2016), ("Trolls", 2016),
    ("The Boss Baby", 2017), ("Captain Underpants", 2017),
    ("How to Train Your Dragon: The Hidden World", 2019), ("Abominable", 2019),
    ("Trolls World Tour", 2020), ("The Croods: A New Age", 2020),
    ("Spirit Untamed", 2021), ("The Boss Baby: Family Business", 2021),
    ("The Bad Guys", 2022), ("Puss in Boots: The Last Wish", 2022),
    ("Ruby Gillman, Teenage Kraken", 2023), ("Trolls Band Together", 2023),
    ("Kung Fu Panda 4", 2024), ("The Wild Robot", 2024),
    ("Dog Man", 2025),
]

# === ILLUMINATION (Minions/Despicable Me studio) ===
illumination = [
    ("Despicable Me", 2010), ("Hop", 2011), ("The Lorax", 2012),
    ("Despicable Me 2", 2013), ("Minions", 2015),
    ("The Secret Life of Pets", 2016), ("Sing", 2016),
    ("Despicable Me 3", 2017), ("The Grinch", 2018),
    ("The Secret Life of Pets 2", 2019), ("Sing 2", 2021),
    ("Minions: The Rise of Gru", 2022), ("The Super Mario Bros. Movie", 2023),
    ("Migration", 2023), ("Despicable Me 4", 2024),
]

# === SONY PICTURES ANIMATION ===
sony = [
    ("Open Season", 2006), ("Surf's Up", 2007), ("Cloudy with a Chance of Meatballs", 2009),
    ("Arthur Christmas", 2011), ("Hotel Transylvania", 2012),
    ("Cloudy with a Chance of Meatballs 2", 2013), ("Hotel Transylvania 2", 2015),
    ("Goosebumps", 2015), ("The Smurfs: The Lost Village", 2017),
    ("The Star", 2017), ("Hotel Transylvania 3", 2018),
    ("Spider-Man: Into the Spider-Verse", 2018), ("The Angry Birds Movie 2", 2019),
    ("The Mitchells vs. the Machines", 2021), ("Vivo", 2021),
    ("Hotel Transylvania: Transformania", 2022),
    ("Spider-Man: Across the Spider-Verse", 2023),
    ("Wish Dragon", 2021),
]

# === BLUE SKY STUDIOS (Ice Age) ===
bluesky = [
    ("Ice Age", 2002), ("Robots", 2005), ("Ice Age: The Meltdown", 2006),
    ("Horton Hears a Who!", 2008), ("Ice Age: Dawn of the Dinosaurs", 2009),
    ("Rio", 2011), ("Ice Age: Continental Drift", 2012), ("Epic", 2013),
    ("Rio 2", 2014), ("The Peanuts Movie", 2015),
    ("Ice Age: Collision Course", 2016), ("Ferdinand", 2017), ("Spies in Disguise", 2019),
]

# === DISNEY LIVE ACTION REMAKES ===
disney_live = [
    ("Alice in Wonderland", 2010), ("Maleficent", 2014), ("Cinderella", 2015),
    ("The Jungle Book", 2016), ("Pete's Dragon", 2016), ("Beauty and the Beast", 2017),
    ("Christopher Robin", 2018), ("Dumbo", 2019), ("Aladdin", 2019),
    ("The Lion King", 2019), ("Lady and the Tramp", 2019), ("Mulan", 2020),
    ("Cruella", 2021), ("Pinocchio", 2022), ("Peter Pan & Wendy", 2023),
    ("The Little Mermaid", 2023), ("Mufasa: The Lion King", 2024),
    ("Snow White", 2025), ("Lilo & Stitch", 2025),
]

# === STUDIO GHIBLI (for kids) ===
ghibli_kids = [
    ("My Neighbor Totoro", 1988), ("Kiki's Delivery Service", 1989),
    ("Spirited Away", 2001), ("Howl's Moving Castle", 2004),
    ("Ponyo", 2008), ("Arrietty", 2010), ("The Cat Returns", 2002),
]

# === LAIKA ===
laika = [
    ("Coraline", 2009), ("ParaNorman", 2012), ("The Boxtrolls", 2014),
    ("Kubo and the Two Strings", 2016), ("Missing Link", 2019),
    ("Wildwood", 2025),
]

# === AARDMAN ===
aardman = [
    ("Chicken Run", 2000), ("Wallace & Gromit: The Curse of the Were-Rabbit", 2005),
    ("Flushed Away", 2006), ("Shaun the Sheep Movie", 2015),
    ("Early Man", 2018), ("Chicken Run: Dawn of the Nugget", 2023),
]

all_studios = {
    "Disney Animation": disney_animation,
    "Pixar": pixar,
    "DreamWorks": dreamworks,
    "Illumination": illumination,
    "Sony Animation": sony,
    "Blue Sky": bluesky,
    "Disney Live Action": disney_live,
    "Studio Ghibli (Kids)": ghibli_kids,
    "Laika": laika,
    "Aardman": aardman,
}

# Cross-reference
def normalize(name):
    import re
    n = name.lower().strip()
    # Remove special characters
    n = re.sub(r'[^\w\s]', '', n)
    n = re.sub(r'\s+', ' ', n)
    return n

def is_in_library(title, year):
    # Exact match
    key = f"{title.lower().strip()}|{year}"
    if key in all_titles:
        return True
    # Fuzzy - try normalized
    norm = normalize(title)
    for lib_key in all_titles:
        lib_name, lib_year = lib_key.rsplit("|", 1)
        if normalize(lib_name.replace(chr(38), "and")) == norm.replace(chr(38), "and"):
            if str(lib_year) == str(year) or abs(int(lib_year or 0) - year) <= 1:
                return True
    # Try partial match
    for lib_key in all_titles:
        lib_name, lib_year = lib_key.rsplit("|", 1)
        if norm in normalize(lib_name) or normalize(lib_name) in norm:
            if str(lib_year) == str(year) or abs(int(lib_year or 0) - year) <= 1:
                return True
    return False

print("=" * 70)
print("KIDS MOVIE LIBRARY GAP ANALYSIS")
print("=" * 70)

total_missing = 0
for studio, movies in all_studios.items():
    missing = []
    found = []
    for title, year in movies:
        if is_in_library(title, year):
            found.append((title, year))
        else:
            missing.append((title, year))
    
    pct = len(found) / len(movies) * 100 if movies else 0
    print(f"\n{'─' * 50}")
    print(f"  {studio}: {len(found)}/{len(movies)} ({pct:.0f}%)")
    print(f"{'─' * 50}")
    
    if missing:
        print(f"  MISSING ({len(missing)}):")
        for title, year in missing:
            print(f"    ✗ {title} ({year})")
        total_missing += len(missing)
    else:
        print(f"  ✓ Complete!")

print(f"\n{'=' * 70}")
print(f"TOTAL MISSING: {total_missing} movies across all studios")
print(f"{'=' * 70}")
