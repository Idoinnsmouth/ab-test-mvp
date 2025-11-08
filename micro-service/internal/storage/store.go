package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	_ "modernc.org/sqlite"
	"plarium-fs-test/micro-service/internal/assignments"
)

var (
	ErrVariantNotFound    = errors.New("storage: variant not found")
	ErrAssignmentNotFound = errors.New("storage: assignment exists but could not be fetched")
)

// Store wraps database access used by the HTTP service.
type Store struct {
	db *sql.DB
}

// New opens a SQLite connection using the provided DSN.
func New(dsn string) (*Store, error) {
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	// SQLite works best with a single writer connection.
	db.SetMaxOpenConns(1)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping sqlite: %w", err)
	}

	return &Store{db: db}, nil
}

// Close releases the underlying DB handle.
func (s *Store) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

// GetAssignment returns an existing assignment if present.
func (s *Store) GetAssignment(ctx context.Context, experimentID, userID string) (assignments.Result, bool, error) {
	const query = `
SELECT a.experimentId, a.userId, v.key
FROM Assignment a
JOIN Variant v ON v.id = a.variantId
WHERE a.experimentId = ? AND a.userId = ?
LIMIT 1;
`
	var result assignments.Result
	err := s.db.QueryRowContext(ctx, query, experimentID, userID).Scan(&result.ExperimentID, &result.UserID, &result.VariantKey)
	if errors.Is(err, sql.ErrNoRows) {
		return assignments.Result{}, false, nil
	}
	if err != nil {
		return assignments.Result{}, false, fmt.Errorf("query assignment: %w", err)
	}
	return result, true, nil
}

// ListVariants fetches the configured variants for an experiment.
func (s *Store) ListVariants(ctx context.Context, experimentID string) ([]assignments.Variant, error) {
	const query = `
SELECT key, weight
FROM Variant
WHERE experimentId = ?
ORDER BY createdAt ASC;
`
	rows, err := s.db.QueryContext(ctx, query, experimentID)
	if err != nil {
		return nil, fmt.Errorf("query variants: %w", err)
	}
	defer rows.Close()

	variants := make([]assignments.Variant, 0)
	for rows.Next() {
		var v assignments.Variant
		if err := rows.Scan(&v.Key, &v.Weight); err != nil {
			return nil, fmt.Errorf("scan variant: %w", err)
		}
		variants = append(variants, v)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate variants: %w", err)
	}

	return variants, nil
}

// PersistAssignment inserts a new sticky assignment. It assumes the variant key
// exists for the provided experiment. If the assignment already exists, the
// stored value is returned, ensuring stable behavior across concurrent calls.
func (s *Store) PersistAssignment(
	ctx context.Context,
	experimentID string,
	userID string,
	variantKey string,
) (assignments.Result, error) {
	variantID, err := s.lookupVariantID(ctx, experimentID, variantKey)
	if err != nil {
		return assignments.Result{}, err
	}

	const stmt = `
INSERT INTO Assignment (userId, experimentId, variantId)
VALUES (?, ?, ?)
ON CONFLICT(experimentId, userId) DO NOTHING;
`
	res, err := s.db.ExecContext(ctx, stmt, userID, experimentID, variantID)
	if err != nil {
		return assignments.Result{}, fmt.Errorf("insert assignment: %w", err)
	}

	if rows, _ := res.RowsAffected(); rows == 0 {
		existing, ok, err := s.GetAssignment(ctx, experimentID, userID)
		if err != nil {
			return assignments.Result{}, err
		}
		if ok {
			return existing, nil
		}
		return assignments.Result{}, ErrAssignmentNotFound
	}

	return assignments.Result{
		ExperimentID: experimentID,
		UserID:       userID,
		VariantKey:   variantKey,
	}, nil
}

func (s *Store) lookupVariantID(ctx context.Context, experimentID, variantKey string) (string, error) {
	const query = `
SELECT id
FROM Variant
WHERE experimentId = ? AND key = ?
LIMIT 1;
`
	var id string
	err := s.db.QueryRowContext(ctx, query, experimentID, variantKey).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrVariantNotFound
	}
	if err != nil {
		return "", fmt.Errorf("lookup variant id: %w", err)
	}
	return id, nil
}
