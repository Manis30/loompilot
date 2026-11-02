FROM mongo:7.0

COPY mongo-keyfile /etc/mongo-keyfile
RUN chmod 400 /etc/mongo-keyfile && chown 999:999 /etc/mongo-keyfile

COPY init-rs.sh /docker-entrypoint-initdb.d/init-rs.sh
RUN chmod +x /docker-entrypoint-initdb.d/init-rs.sh

CMD ["--replSet", "rs0", "--bind_ip_all", "--keyFile", "/etc/mongo-keyfile"]

