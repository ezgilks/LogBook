FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/logbook-sync ./cmd/logbook-sync

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/logbook-sync /logbook-sync
EXPOSE 8080
ENTRYPOINT ["/logbook-sync"]
