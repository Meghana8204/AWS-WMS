# Multi-stage build: compile with Maven, run on a slim JRE.
# Build with the backend directory as context, e.g.:
#   docker build -f auth-service/Dockerfile -t ams-auth-service backend
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

COPY pom.xml /build/pom.xml
COPY common /build/common
COPY auth-service /build/auth-service

RUN mvn -q -pl common,auth-service -am -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --create-home appuser
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY --from=build /build/auth-service/target/auth-service.jar /app/auth-service.jar
USER appuser
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD curl -f http://localhost:8080/actuator/health || exit 1
ENTRYPOINT ["java", "-jar", "/app/auth-service.jar"]
