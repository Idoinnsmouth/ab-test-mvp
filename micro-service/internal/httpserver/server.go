package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"plarium-fs-test/micro-service/internal/assignments"
	"plarium-fs-test/micro-service/internal/storage"
)

// Config configures the HTTP server.
type Config struct {
	Addr string
}

// Server wires the HTTP transport to the assignment service.
type Server struct {
	httpServer *http.Server
	service    *assignments.Service
	store      *storage.Store
}

func New(cfg Config, svc *assignments.Service, store *storage.Store) *Server {
	mux := http.NewServeMux()
	srv := &Server{
		httpServer: &http.Server{
			Addr:              cfg.Addr,
			Handler:           mux,
			ReadHeaderTimeout: 5 * time.Second,
		},
		service: svc,
		store:   store,
	}

	mux.HandleFunc("/health", srv.handleHealth)
	mux.HandleFunc("/assign", srv.handleAssign)

	return srv
}

// Run starts the HTTP server and blocks until the provided context is canceled
// or the server exits with an error.
func (s *Server) Run(ctx context.Context) error {
	errCh := make(chan error, 1)
	go func() {
		log.Printf("assignment service listening on %s", s.httpServer.Addr)
		errCh <- s.httpServer.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := s.httpServer.Shutdown(shutdownCtx); err != nil {
			return err
		}
		return ctx.Err()
	case err := <-errCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleAssign(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	var payload assignRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&payload); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if result, ok, err := s.store.GetAssignment(r.Context(), payload.ExperimentID, payload.UserID); err != nil {
		log.Printf("get assignment: %v", err)
		http.Error(w, "failed to query assignment", http.StatusInternalServerError)
		return
	} else if ok {
		writeJSON(w, http.StatusOK, result)
		return
	}

	variants, err := s.store.ListVariants(r.Context(), payload.ExperimentID)
	if err != nil {
		log.Printf("list variants: %v", err)
		http.Error(w, "failed to load variants", http.StatusInternalServerError)
		return
	}
	if len(variants) == 0 {
		http.Error(w, "experiment has no variants", http.StatusUnprocessableEntity)
		return
	}

	result, err := s.service.Assign(payload.ExperimentID, payload.UserID, variants)
	if err != nil {
		status := http.StatusInternalServerError
		switch err {
		case assignments.ErrInvalidMetadata:
			status = http.StatusBadRequest
		case assignments.ErrNoVariants, assignments.ErrNoWeightedSpace:
			status = http.StatusUnprocessableEntity
		}
		http.Error(w, err.Error(), status)
		return
	}

	persisted, err := s.store.PersistAssignment(r.Context(), payload.ExperimentID, payload.UserID, result.VariantKey)
	if err != nil {
		status := http.StatusInternalServerError
		switch err {
		case storage.ErrVariantNotFound:
			status = http.StatusUnprocessableEntity
		case storage.ErrAssignmentNotFound:
			status = http.StatusInternalServerError
		}
		http.Error(w, err.Error(), status)
		return
	}

	writeJSON(w, http.StatusOK, persisted)
}

type assignRequest struct {
	ExperimentID string `json:"experimentId"`
	UserID       string `json:"userId"`
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
