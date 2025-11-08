package main

import (
	"context"
	"errors"
	"log"
	"os"
	"os/signal"
	"plarium-fs-test/micro-service/internal/assignments"
	"plarium-fs-test/micro-service/internal/httpserver"
	"plarium-fs-test/micro-service/internal/storage"
	"syscall"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	addr := getEnv("PORT", "8080")
	dsn := getEnv("ASSIGNMENTS_DATABASE_URL", "")
	if dsn == "" {
		dsn = getEnv("DATABASE_URL", "")
	}
	if dsn == "" {
		log.Fatal("ASSIGNMENTS_DATABASE_URL or DATABASE_URL must be set")
	}

	store, err := storage.New(dsn)
	if err != nil {
		log.Fatalf("init storage: %v", err)
	}
	defer func() {
		if err := store.Close(); err != nil {
			log.Printf("close store: %v", err)
		}
	}()

	svc := assignments.NewService()
	server := httpserver.New(httpserver.Config{Addr: ":" + addr}, svc, store)

	if err := server.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
		log.Fatalf("server exited: %v", err)
	}

	log.Println("server shutdown complete")
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
