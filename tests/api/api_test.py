"""
End-to-end test of the app's data layer through PostgREST, using the same
queries (select strings, filters, RPC calls, headers) that supabase-js sends from the app.
A full user journey: onboarding -> trip -> places -> days -> sharing -> store -> purchase -> review -> admin.
"""
import base64, hashlib, hmac, json, os, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

API = os.environ["API"]
SECRET = os.environ["JWT_SECRET"].encode()
PASSED = 0


def jwt(sub=None, role="authenticated"):
    b64 = lambda d: base64.urlsafe_b64encode(json.dumps(d, separators=(",", ":")).encode()).rstrip(b"=")
    claims = {"role": role, "exp": int(time.time()) + 3600, **({"sub": sub} if sub else {})}
    head = b64({"alg": "HS256", "typ": "JWT"}) + b"." + b64(claims)
    sig = base64.urlsafe_b64encode(hmac.new(SECRET, head, hashlib.sha256).digest()).rstrip(b"=")
    return (head + b"." + sig).decode()


def call(method, path, token=None, body=None, params=None, prefer=None, single=False):
    url = f"{API}{path}" + ("?" + urllib.parse.urlencode(params, safe="(),!.*:") if params else "")
    headers = {"Content-Type": "application/json"}
    if token: headers["Authorization"] = f"Bearer {token}"
    if prefer: headers["Prefer"] = prefer
    if single: headers["Accept"] = "application/vnd.pgrst.object+json"
    req = urllib.request.Request(url, method=method, headers=headers, data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else None), dict(r.headers)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        return e.code, (json.loads(raw) if raw else None), dict(e.headers)


def ok(cond, name, detail=""):
    global PASSED
    if not cond:
        print(f"FAIL  {name}  {detail}")
        sys.exit(1)
    PASSED += 1
    print(f"PASS  {name}")


def expect(status, want, name, body=None):
    ok(status == want, name, f"(got {status}, want {want}) {json.dumps(body, ensure_ascii=False)[:400] if body is not None else ''}")


def sql(q):
    subprocess.run(["psql", "-h", os.environ["PGHOST"], "-p", os.environ["PGPORT"], "-U", "postgres", "-d", "postgres",
                    "-v", "ON_ERROR_STOP=1", "-q", "-c", q], check=True, capture_output=True)


get = lambda path, t=None, **p: call("GET", path, t, params=p)
rpc = lambda fn, t=None, **args: call("POST", f"/rpc/{fn}", t, body=args)
RET = "return=representation"

# ---------- users (Supabase Auth would create these) ----------
NOA, DANA, ADMIN = "a1111111-0000-0000-0000-000000000001", "a2222222-0000-0000-0000-000000000002", "a3333333-0000-0000-0000-000000000003"
sql(f"""insert into auth.users (id, email, raw_user_meta_data) values
 ('{NOA}', 'noa@example.com', '{{"full_name":"נועה ברק"}}'),
 ('{DANA}', 'dana@example.com', '{{"name":"דנה"}}'),
 ('{ADMIN}', 'admin@example.com', '{{}}');
 update public.profiles set role = 'admin', onboarding_completed_at = now() where id = '{ADMIN}';""")
Y, D, A, SERVICE = jwt(NOA), jwt(DANA), jwt(ADMIN), jwt(role="service_role")

# ---------- health (api/health) ----------
s, b, h = call("HEAD", "/categories", params={"select": "id"}, prefer="count=exact")
ok(s in (200, 206) and h.get("Content-Range", "").endswith("/12"), "health: anonymous category count = 12", h.get("Content-Range"))

# ---------- session + onboarding ----------
s, b, _ = call("GET", "/profiles", Y, params={"select": "display_name,onboarding_completed_at,role", "id": f"eq.{NOA}"}, single=True)
expect(s, 200, "session.loadProfile", b); ok(b["display_name"] == "נועה ברק" and b["role"] == "user", "profile from sign-up metadata")
s, b, _ = rpc("complete_onboarding", Y, p_travel_styles=["food", "culture"], p_budget="medium", p_transport=["walk", "transit"])
ok(s in (200, 204), "rpc complete_onboarding", f"{s} {b}")
s, b, _ = call("GET", "/user_preferences", Y, params={"select": "travel_styles,budget_level,default_transport", "user_id": f"eq.{NOA}"}, single=True)
expect(s, 200, "trips.getPreferences", b)
rpc("complete_onboarding", D)

# ---------- create trip (trips/actions.createTrip) ----------
s, b, _ = call("POST", "/trips", Y, params={"select": "id"}, prefer=RET, single=True, body={
    "owner_id": NOA, "title": "רומא", "destination_name": "רומא, איטליה", "destination_place_id": "ChIJu46S-ZZhLxMROG5lkwZ3D7k",
    "center_lat": 41.9028, "center_lng": 12.4964, "start_date": "2026-10-10", "end_date": "2026-10-12", "travelers_count": 2,
    "transport_modes": ["walk", "transit"], "travel_styles": ["food"], "budget_level": "medium"})
expect(s, 201, "createTrip insert", b); TRIP = b["id"]

# ---------- my trips + trip page ----------
s, b, _ = get("/trips", Y, select="id,title,destination_name,start_date,end_date,created_at,visibility,saved_places!saved_places_trip_id_fkey(count),trip_places(count)", order="created_at.desc")
expect(s, 200, "trips.getMyTrips (embedded counts)", b); ok(len(b) == 1 and b[0]["saved_places"] == [{"count": 0}], "getMyTrips shape")
s, b, _ = get("/trips", Y, select="id,saved_places(count)")
ok(s == 300 or s >= 400, "without the FK hint the embed IS ambiguous (the bug that was fixed)", str(s))
s, b, _ = call("GET", "/trips", Y, single=True, params={
    "select": "id,title,destination_name,destination_place_id,center_lat,center_lng,start_date,end_date,travelers_count,transport_modes,travel_styles,budget_level,visibility,saved_places!saved_places_trip_id_fkey(count),trip_days(id,day_index,date,title,trip_places(count))",
    "id": f"eq.{TRIP}", "trip_days.order": "day_index.asc"})
expect(s, 200, "trips.getTrip", b); ok([d["day_index"] for d in b["trip_days"]] == [1, 2, 3], "getTrip: 3 days in order")
s, b, _ = get("/trips", D, id=f"eq.{TRIP}", select="id")
ok(s == 200 and b == [], "another user cannot read the trip")

# ---------- places (places-actions.savePlaceToTrip) ----------
s, b, _ = call("POST", "/places", Y, body={"google_place_id": "ChIJfake_by_user_000", "lat": 0, "lng": 0})
ok(s in (401, 403), "users cannot write the places table", str(s))
PLACES = {}
for gid, lat, lng in [("ChIJpantheon_00000001", 41.8986, 12.4769), ("ChIJcolosseum_0000001", 41.8902, 12.4922),
                      ("ChIJnavona_000000001", 41.8992, 12.4731), ("ChIJhotel_0000000001", 41.8960, 12.4800)]:
    s, b, _ = rpc("upsert_place", SERVICE, p_google_place_id=gid, p_lat=lat, p_lng=lng, p_primary_type="tourist_attraction")
    expect(s, 200, f"admin rpc upsert_place {gid[:14]}", b); PLACES[gid] = b
s, cat, _ = call("GET", "/categories", Y, params={"select": "id", "key": "eq.attraction"}, single=True)
expect(s, 200, "places-actions.categoryId", cat)
SAVED = {}
for gid, label in [("ChIJpantheon_00000001", "הפנתיאון"), ("ChIJcolosseum_0000001", "הקולוסיאום"), ("ChIJnavona_000000001", "נבונה"), ("ChIJhotel_0000000001", "המלון")]:
    s, b, _ = call("POST", "/saved_places", Y, params={"select": "id,status,is_must"}, prefer=RET, single=True,
                   body={"trip_id": TRIP, "place_id": PLACES[gid], "category_id": cat["id"], "label": label, "is_must": False})
    expect(s, 201, f"save {label}", b); SAVED[label] = b["id"]
s, b, _ = call("POST", "/saved_places", Y, params={"select": "id,status,is_must"}, prefer=RET, single=True,
               body={"trip_id": TRIP, "place_id": PLACES["ChIJpantheon_00000001"], "category_id": cat["id"], "label": "x", "is_must": False})
ok(s == 409 and b.get("code") == "23505", "saving twice returns code 23505 (the app then returns the existing place)", str(b))
s, b, _ = get("/saved_places_on_map", Y, select="id,google_place_id,lat,lng,label,category_key,is_must,status,personal_note,created_at", trip_id=f"eq.{TRIP}", order="created_at.asc")
expect(s, 200, "places.getMapPlaces", b); ok(len(b) == 4 and b[0]["category_key"] == "attraction" and b[0]["lat"] == 41.8986, "map places shape")
s, b, _ = call("GET", "/saved_places_on_map", Y, single=True, params={"select": "id,label,category_key,is_must,status,personal_note", "trip_id": f"eq.{TRIP}", "google_place_id": "eq.ChIJpantheon_00000001"})
expect(s, 200, "savePlace: existing lookup", b)
s, b, _ = call("PATCH", "/trips", Y, params={"id": f"eq.{TRIP}"}, body={"hotel_saved_place_id": SAVED["המלון"]})
expect(s, 204, "setTripHotel", b)
s, b, _ = call("PATCH", "/saved_places", Y, params={"id": f"eq.{SAVED['הפנתיאון']}", "trip_id": f"eq.{TRIP}", "select": "id"}, prefer=RET,
               body={"label": "הפנתיאון!", "personal_note": "להגיע מוקדם", "is_must": True})
expect(s, 200, "updateSavedPlace", b); ok(len(b) == 1, "updateSavedPlace touched one row")

# ---------- days (plan-actions) ----------
s, days, _ = get("/trip_days", Y, select="id,day_index,date,title,start_time,trip_places(id,saved_place_id,position,planned_time,duration_min,note)", trip_id=f"eq.{TRIP}", order="day_index.asc")
expect(s, 200, "planning.getTripPlan", days); D1, D2 = days[0]["id"], days[1]["id"]
stops = []
for label in ["הקולוסיאום", "הפנתיאון", "נבונה"]:
    s, b, _ = rpc("add_stop_to_day", Y, p_day_id=D1, p_saved_place_id=SAVED[label])
    expect(s, 200, f"addStop {label}", b); stops.append(b)
s, b, _ = rpc("set_day_order", Y, p_day_id=D1, p_stop_ids=[stops[1], stops[2], stops[0]])
ok(s in (200, 204), "setDayOrder (reorder)", f"{s} {b}")
s, b, _ = rpc("set_day_order", Y, p_day_id=D2, p_stop_ids=[stops[0]])
ok(s in (200, 204), "setDayOrder (move to day 2)", f"{s} {b}")
s, b, _ = rpc("set_day_order", D, p_day_id=D1, p_stop_ids=[])
ok(s >= 400, "another user cannot reorder", str(s))
s, b, _ = call("PATCH", "/trip_places", Y, params={"id": f"eq.{stops[1]}", "trip_id": f"eq.{TRIP}", "select": "id"}, prefer=RET,
               body={"planned_time": "09:30", "duration_min": 90, "note": "כרטיסים"})
expect(s, 200, "updateStop", b)
s, b, _ = call("PATCH", "/trip_places", Y, params={"id": f"eq.{stops[2]}", "trip_id": f"eq.{TRIP}"}, body={"planned_time": "11:15"})
expect(s, 204, "applyTimes", b)
s, b, _ = call("PATCH", "/trip_days", Y, params={"id": f"eq.{D1}", "trip_id": f"eq.{TRIP}", "select": "id"}, prefer=RET, body={"title": "מרכז", "start_time": "08:30"})
expect(s, 200, "updateDay", b)
s, b, _ = rpc("set_place_visited", Y, p_saved_place_id=SAVED["נבונה"], p_visited=True)
ok(s == 200 and b == "visited", "setVisited", str(b))
s, b, _ = get("/trip_days", Y, select="day_index,date,trip_places(saved_place_id)", trip_id=f"eq.{TRIP}", order="day_index.asc")
expect(s, 200, "suggestDayPlan: days with stops", b)
s, b, _ = rpc("count_stops_after_day", Y, p_trip_id=TRIP, p_last_day=1)
ok(s == 200 and b == 1, "count_stops_after_day", str(b))
s, days, _ = get("/trip_days", Y, select="id,day_index,date,title,start_time,trip_places(id,saved_place_id,position,planned_time,duration_min,note)", trip_id=f"eq.{TRIP}", order="day_index.asc")
d1 = sorted(days[0]["trip_places"], key=lambda x: x["position"])
ok([x["saved_place_id"] for x in d1] == [SAVED["הפנתיאון"], SAVED["נבונה"]] and d1[0]["planned_time"] == "09:30:00" and days[0]["start_time"] == "08:30:00",
   "the plan reads back exactly (order, times; times come back as HH:MM:SS and the app trims them)")
s, b, _ = call("POST", "/recommendation_events", Y, body={"trip_id": TRIP, "anchor_saved_place_id": SAVED["הפנתיאון"], "google_place_id": "ChIJx", "category_key": "cafe", "action": "added"})
expect(s, 201, "logRecommendation", b)
s, b, _ = rpc("consume_api_quota", Y, p_endpoint="nearby", p_daily_limit=60)
ok(s == 200 and b is True, "consume_api_quota", str(b))
s, b, _ = rpc("consume_api_quota", None, p_endpoint="nearby", p_daily_limit=60)
ok(s in (401, 403), "anonymous cannot use the quota (Google proxy)", str(s))

# ---------- sharing ----------
s, b, _ = call("PATCH", "/trips", Y, params={"id": f"eq.{TRIP}", "select": "share_token"}, prefer=RET, single=True, body={"visibility": "link"})
expect(s, 200, "setTripVisibility", b); TOKEN = b["share_token"]; ok(len(TOKEN) == 64, "share token")
s, b, _ = rpc("get_shared_trip", None, p_token=TOKEN)
expect(s, 200, "anonymous get_shared_trip", b)
ok(b["trip"]["title"] == "רומא" and b["hotel"]["label"] == "המלון" and "להגיע מוקדם" not in json.dumps(b, ensure_ascii=False), "shared view: content, hotel, no private notes")
s, b, _ = rpc("clone_shared_trip", D, p_token=TOKEN)
expect(s, 200, "clone_shared_trip", b); COPY = b
s, b, _ = get("/trips", D, select="id,title", id=f"eq.{COPY}")
ok(b and b[0]["title"] == "רומא (עותק)", "the copy is in Dana's trips")

# ---------- creator + publish ----------
s, b, _ = rpc("become_creator", Y, p_slug="noa-rome", p_display_name="נועה מטיילת", p_bio=None)
ok(s in (200, 204), "become_creator", f"{s} {b}")
s, b, _ = get("/creators", Y, select="user_id,slug,display_name,bio,avatar_url,created_at", user_id=f"eq.{NOA}")
ok(s == 200 and b[0]["slug"] == "noa-rome", "market.getMyCreator")
s, b, _ = get("/trips", Y, select="id,title,trip_places(count)", order="created_at.desc")
expect(s, 200, "creator page: my trips with stop counts", b)
s, ROUTE, _ = rpc("publish_trip", Y, p_trip_id=TRIP, p_title="רומא ב-3 ימים", p_description="מסלול מלא לשלושה ימים ברומא עם טיפים", p_price_agorot=4900)
expect(s, 200, "publish_trip", ROUTE)
s, b, _ = get("/published_trips", Y, select="id,title,description,price_agorot,status,review_note,days_count,places_count,created_at,purchases(count)", creator_id=f"eq.{NOA}", order="created_at.desc")
expect(s, 200, "market.getMyRoutes", b); ok(b[0]["status"] == "pending" and b[0]["purchases"] == [{"count": 0}], "my routes shape")
s, b, _ = get("/trips", Y, select="id")
ok(len(b) == 1, "the frozen snapshot is hidden from the creator's trips")
s, b, _ = get("/platform_settings", None, select="value", key="eq.commission_rate")
ok(s == 200 and float(b[0]["value"]) == 0.2, "market.getSetting (anonymous)", str(b))

# ---------- admin ----------
s, b, _ = get("/published_trips", A, select="id,title,description,price_agorot,places_count,days_count,created_at,creators(display_name,slug)", status="eq.pending", order="created_at")
expect(s, 200, "admin: pending routes with creator", b); ok(b[0]["creators"]["slug"] == "noa-rome", "creator embedded")
s, b, _ = rpc("admin_set_route_status", Y, p_route=ROUTE, p_status="published", p_note=None)
ok(s >= 400, "non-admin cannot approve", str(s))
s, b, _ = rpc("admin_set_route_status", A, p_route=ROUTE, p_status="published", p_note=None)
ok(s in (200, 204), "admin approves", f"{s} {b}")
s, b, _ = rpc("admin_stats", A)
expect(s, 200, "admin_stats", b); ok(b["routes_published"] == 1, "stats")
s, b, _ = rpc("admin_list_users", A, p_search="dana", p_limit=50)
ok(s == 200 and len(b) == 1 and b[0]["email"] == "dana@example.com", "admin_list_users search", str(b))
s, b, _ = get("/reports", A, select="id,target_type,target_id,reason,created_at", status="eq.open", order="created_at")
expect(s, 200, "admin: reports", b)

# ---------- store ----------
COLS = "id,title,description,destination_name,days_count,places_count,price_agorot,published_at,creator_slug,creator_name,creator_avatar,rating_avg,rating_count,acquisitions"
for sort in ["acquisitions.desc,rating_avg.desc", "published_at.desc", "rating_avg.desc,rating_count.desc", "price_agorot.asc"]:
    s, b, _ = get("/routes_catalog", None, select=COLS, order=sort, limit="60")
    ok(s == 200 and len(b) == 1, f"catalog sorted by {sort.split('.')[0]}", str(s))
s, b, _ = get("/routes_catalog", None, select=COLS, destination_name="ilike.*רומא*")
ok(s == 200 and len(b) == 1, "catalog search by destination (ilike)", str(b)[:200])
s, b, _ = get("/routes_catalog", None, select=COLS, creator_slug="eq.noa-rome")
ok(s == 200 and len(b) == 1, "creator page routes")
s, b, _ = get("/creators", None, select="user_id,slug,display_name,bio,avatar_url,created_at", slug="eq.noa-rome")
ok(s == 200 and len(b) == 1, "public creator page")
s, b, _ = rpc("route_preview", None, p_route=ROUTE)
ok(s == 200 and len(b["days"]) == 3 and b["days"][0]["stops"] is not None and b["days"][1]["stops"] is None, "route preview: day 1 only", str(b)[:200])

# ---------- purchase (webhook -> record_paid_purchase) ----------
s, b, _ = get("/routes_catalog", D, select="id,title,price_agorot", id=f"eq.{ROUTE}")
ok(b[0]["price_agorot"] == 4900, "buyRoute: price lookup")
s, b, _ = rpc("record_paid_purchase", D, p_buyer=DANA, p_route=ROUTE, p_amount=4900, p_provider="stripe", p_ref="cs_test_x")
ok(s >= 400, "buyer cannot record own payment", str(s))
s, BOUGHT, _ = rpc("record_paid_purchase", SERVICE, p_buyer=DANA, p_route=ROUTE, p_amount=4900, p_provider="stripe", p_ref="cs_test_x")
expect(s, 200, "webhook: record_paid_purchase", BOUGHT)
s, again, _ = rpc("record_paid_purchase", SERVICE, p_buyer=DANA, p_route=ROUTE, p_amount=4900, p_provider="stripe", p_ref="cs_test_x")
ok(again == BOUGHT, "webhook twice -> same purchase")
s, b, _ = get("/purchases", D, select="id,copied_trip_id", published_trip_id=f"eq.{ROUTE}", buyer_id=f"eq.{DANA}", status="eq.paid")
ok(s == 200 and b[0]["copied_trip_id"] == BOUGHT, "market.getMyCopy"); PURCHASE = b[0]["id"]
s, b, _ = get("/trip_places", D, select="id", trip_id=f"eq.{BOUGHT}")
ok(len(b) == 3, "the buyer's copy has all 3 stops")

# ---------- review + report ----------
s, b, _ = rpc("submit_review", D, p_route=ROUTE, p_rating=5, p_body="מעולה")
expect(s, 200, "submit_review", b); REVIEW = b
s, b, _ = get("/reviews", D, select="rating,body", purchase_id=f"eq.{PURCHASE}")
ok(b[0]["rating"] == 5, "my review")
s, b, _ = get("/reviews_public", None, select="id,rating,body,created_at,author_first_name", published_trip_id=f"eq.{ROUTE}", order="created_at.desc", limit="50")
ok(s == 200 and b[0]["author_first_name"] == "דנה", "public reviews (first name only)", str(b))
s, b, _ = get("/routes_catalog", None, select="rating_avg,rating_count,acquisitions", id=f"eq.{ROUTE}")
ok(float(b[0]["rating_avg"]) == 5 and b[0]["acquisitions"] == 1, "store shows rating + popularity")
s, b, _ = call("POST", "/reports", D, body={"reporter_id": DANA, "target_type": "review", "target_id": REVIEW, "reason": "בדיקת דיווח"})
expect(s, 201, "reportContent", b)
s, b, _ = get("/creator_balances", Y, select="earned_agorot,paid_out_agorot,sales_count")
ok(b[0]["earned_agorot"] == 3920 and b[0]["sales_count"] == 1, "creator balance after 20% commission", str(b))
s, b, _ = get("/creator_balances", A, select="creator_id,display_name,slug,earned_agorot,paid_out_agorot,sales_count")
ok(s == 200 and len(b) == 1, "admin sees balances")
s, b, _ = rpc("admin_record_payout", A, p_creator=NOA, p_amount=3920, p_reference="העברה 1")
expect(s, 200, "admin_record_payout", b)
s, b, _ = call("PATCH", "/reviews", A, params={"id": f"eq.{REVIEW}"}, body={"status": "hidden"})
expect(s, 204, "admin hides a review", b)
s, b, _ = rpc("admin_resolve_report", A, p_report=get("/reports", A, select="id")[1][0]["id"], p_status="resolved")
ok(s in (200, 204), "admin_resolve_report", f"{s} {b}")
s, b, _ = rpc("admin_set_setting", A, p_key="commission_rate", p_value=0.15)
ok(s in (200, 204), "admin_set_setting (number value, as the app sends it)", f"{s} {b}")
s, b, _ = rpc("admin_set_role", A, p_user=DANA, p_role="creator")
ok(s in (200, 204), "admin_set_role", f"{s} {b}")
s, b, _ = rpc("update_my_route", Y, p_route_id=ROUTE, p_title="רומא ב-3 ימים", p_description="מסלול מלא לשלושה ימים ברומא, מעודכן", p_price_agorot=5900, p_unpublish=False)
ok(s == 200 and b == "pending", "update_my_route", str(b))
s, b, _ = call("PATCH", "/creators", Y, params={"user_id": f"eq.{NOA}"}, body={"display_name": "נועה", "bio": "חדש"})
expect(s, 204, "updateCreatorProfile", b)
s, b, _ = call("PATCH", "/profiles", Y, params={"id": f"eq.{NOA}"}, body={"display_name": "נועה ב."})
expect(s, 204, "updateDisplayName", b)
s, b, _ = call("PATCH", "/profiles", Y, params={"id": f"eq.{NOA}"}, body={"role": "admin"})
ok(s >= 400, "a user cannot make themselves admin through the API", str(s))

# ---------- delete ----------
s, b, _ = call("DELETE", "/trips", D, params={"id": f"eq.{COPY}", "select": "id"}, prefer=RET)
ok(s == 200 and len(b) == 1, "deleteTrip")
s, b, _ = call("DELETE", "/saved_places", Y, params={"id": f"eq.{SAVED['נבונה']}", "trip_id": f"eq.{TRIP}", "select": "id"}, prefer=RET)
ok(s == 200 and len(b) == 1, "removeSavedPlace")
s, b, _ = rpc("delete_my_account", D)
ok(s in (200, 204), "delete_my_account", f"{s} {b}")
s, b, _ = get("/profiles", A, select="id", id=f"eq.{DANA}")
ok(s == 200 and b == [], "the account is gone")

print(f"\nALL API TESTS PASSED ({PASSED})")
