import psycopg
try:
    conn = psycopg.connect(
        dbname="supplier_enterprise_db",
        user="postgres",
        password="Harsha@2003",
        host="localhost"
    )
    cur = conn.cursor()
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'suppliers_supplier'")
    cols = cur.fetchall()
    for col in cols:
        print(col)
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
