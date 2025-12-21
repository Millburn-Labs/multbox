;; ============================================================================
;; STORAGE DEFINITIONS
;; ============================================================================
;; This file contains all storage definitions for the multbox contract
;; Note: In Clarity, storage must be defined in the main contract file
;; This file is for reference and documentation

;; Board management
(define-map board-members principal bool)
(define-data-var board-member-count uint u0)

;; Transaction storage
(define-map transactions uint {
    proposer: principal,
    tx-type: uint,
    recipient: principal,
    amount: uint,
    token-contract: (optional principal),
    executed: bool,
    cancelled: bool,
    approval-count: uint,
    created-at: uint,
    expires-at: uint,
    metadata: (optional (string-utf8 500)),
    batch-transfers: (optional (list 10 {
        recipient: principal,
        amount: uint,
        token-contract: (optional principal)
    })),
    new-member: (optional principal),
    threshold-value: (optional uint)
})

;; Approval tracking
(define-map transaction-approvers uint (list 20 principal))

;; Configuration
(define-data-var next-transaction-id uint u0)
(define-data-var initialized bool false)
(define-data-var paused bool false)
(define-data-var approval-threshold uint DEFAULT_MAJORITY_THRESHOLD)

;; Statistics
(define-data-var total-transactions uint u0)
(define-data-var executed-transactions uint u0)
(define-data-var cancelled-transactions uint u0)
(define-data-var expired-transactions uint u0)

