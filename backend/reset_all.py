import psycopg
import os
import shutil

def run():
    try:
        conn = psycopg.connect(
            dbname="postgres",
            user="postgres",
            password="Harsha@2003",
            host="localhost",
            autocommit=True
        )
        cur = conn.cursor()
        cur.execute("DROP DATABASE IF EXISTS supplier_enterprise_db")
        cur.execute("CREATE DATABASE supplier_enterprise_db")
        print("Database 'supplier_enterprise_db' reset.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"DB Reset Error: {e}")

if __name__ == "__main__":
    run()
