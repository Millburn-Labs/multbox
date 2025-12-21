;; ============================================================================
;; HELPER FUNCTIONS
;; ============================================================================
;; This file contains all private helper functions
;; Note: In Clarity, functions must be defined in the main contract file
;; This file is for reference and documentation

(define-private (check-board-member (caller principal))
    (default-to false (map-get? board-members caller))
)

(define-private (check-initialized)
    (var-get initialized)
)

(define-private (check-paused)
    (var-get paused)
)

(define-private (get-current-block)
    (block-height)
)

(define-private (calculate-expiry (created-at uint))
    (+ created-at (* PROPOSAL_EXPIRY_DAYS BLOCKS_PER_DAY))
)

