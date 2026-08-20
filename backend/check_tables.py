import psycopg
try:
    conn = psycopg.connect(
        dbname="supplier_enterprise_db",
        user="postgres",
        password="Harsha@2003",
        host="localhost"
    )
    cur = conn.cursor()
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
    tabs = cur.fetchall()
    for t in tabs:
        print(t)
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
