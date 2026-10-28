#!/bin/bash
set -e

# Wait for MongoDB to start
echo "Initializing MongoDB Replica Set rs0..."
until mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
  sleep 1
done

echo "MongoDB is up. Initiating replica set if not already initiated..."
mongosh --eval '
try {
  rs.status();
  print("Replica set already initiated.");
} catch (e) {
  rs.initiate({
    _id: "rs0",
    members: [{ _id: 0, host: "mongo:27017" }]
  });
  print("Replica set rs0 initiated.");
}
'

# Wait for replica set to become primary
until mongosh --eval "rs.isMaster().ismaster" | grep -q 'true'; do
  echo "Waiting for replica set primary..."
  sleep 1
done

echo "Configuring users..."
mongosh loompilot --eval '
const adminDb = db.getSiblingDB("admin");
if (!adminDb.getUser("loompilot_admin")) {
  adminDb.createUser({
    user: "loompilot_admin",
    pwd: "loompilot_admin_pass",
    roles: [
      { role: "userAdminAnyDatabase", db: "admin" },
      { role: "readWriteAnyDatabase", db: "admin" },
      { role: "dbAdminAnyDatabase", db: "admin" },
      { role: "clusterAdmin", db: "admin" }
    ]
  });
  print("Created admin user.");
}

const appDb = db.getSiblingDB("loompilot");
if (!appDb.getUser("agent_ro")) {
  appDb.createUser({
    user: "agent_ro",
    pwd: "agent_ro_pass",
    roles: [
      { role: "read", db: "loompilot" }
    ]
  });
  print("Created agent_ro read-only user on loompilot.");
}
'

echo "MongoDB Replica Set initialization complete."

