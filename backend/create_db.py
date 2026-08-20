import psycopg
try:
    conn = psycopg.connect(
        dbname="postgres",
        user="postgres",
        password="Harsha@2003",
        host="localhost",
        autocommit=True
    )
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM pg_database WHERE datname = 'supplier_enterprise_db'")
    if not cur.fetchone():
        cur.execute("CREATE DATABASE supplier_enterprise_db")
        print("Database 'supplier_enterprise_db' created.")
    else:
        print("Database 'supplier_enterprise_db' already exists.")
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
