package assignments

import (
	"errors"
	"fmt"
	"hash/fnv"
	"strings"
)

type Variant struct {
	Key    string `json:"key"`
	Weight int    `json:"weight"`
}

type Result struct {
	ExperimentID string `json:"experimentId"`
	UserID       string `json:"userId"`
	VariantKey   string `json:"variantKey"`
}

// errors
var (
	ErrNoVariants      = errors.New("assignments: at least one variant is required")
	ErrInvalidMetadata = errors.New("assignments: experimentId and userId must be provided")
	ErrNoWeightedSpace = errors.New("assignments: total variant weight must be positive")
)

// Service encapsulates the deterministic assignment logic. It does not
// persist data; it simply implements a sticky selection based on the
// provided identifiers and variants slice.
type Service struct{}

func NewService() *Service {
	return &Service{}
}

// Assign deterministically maps a (userId, experimentId) pair to one of the
// provided variants. The same inputs always result in the same variant as long
// as the variants slice (keys + weights) is stable.
func (s *Service) Assign(
	experimentID string,
	userID string,
	variants []Variant,
) (Result, error) {
	experimentID = strings.TrimSpace(experimentID)
	userID = strings.TrimSpace(userID)
	if experimentID == "" || userID == "" {
		return Result{}, ErrInvalidMetadata
	}

	// prepare a filtered slice for the variants
	filtered := make([]Variant, 0, len(variants))
	totalWeight := 0
	for _, variant := range variants {
		key := strings.TrimSpace(variant.Key)
		if key == "" || variant.Weight <= 0 {
			continue
		}
		filtered = append(filtered, Variant{Key: key, Weight: variant.Weight})
		totalWeight += variant.Weight
	}

	if len(filtered) == 0 {
		return Result{}, ErrNoVariants
	}

	if totalWeight <= 0 {
		return Result{}, ErrNoWeightedSpace
	}

	boundary := stableHash(experimentID + ":" + userID)
	pick := int(boundary % uint64(totalWeight))

	running := 0
	for _, variant := range filtered {
		running += variant.Weight
		if pick < running {
			return Result{
				ExperimentID: experimentID,
				UserID:       userID,
				VariantKey:   variant.Key,
			}, nil
		}
	}

	// The loop above should always return once pick falls inside the running total.
	// If it did not, it means we miscomputed totalWeight.
	return Result{}, fmt.Errorf("assignments: failed to pick variant for %s", experimentID)
}

func stableHash(input string) uint64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(input))
	return h.Sum64()
}
