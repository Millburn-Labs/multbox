;; ============================================================================
;; CONSTANTS AND CONFIGURATION
;; ============================================================================
;; This file contains all constants used across the multbox contract
;; Note: In Clarity, constants must be defined in the main contract file
;; This file is for reference and documentation purposes

(define-constant BOARD_SIZE u20)
(define-constant DEFAULT_MAJORITY_THRESHOLD u11)
(define-constant HIGH_THRESHOLD u15) ;; For sensitive operations like board changes
(define-constant PROPOSAL_EXPIRY_DAYS u30) ;; 30 days in blocks
(define-constant BLOCKS_PER_DAY u144) ;; Approximate blocks per day (144 blocks = 24 hours at 10 min/block)

;; Transaction types
(define-constant TX_TYPE_TRANSFER u1)
(define-constant TX_TYPE_BATCH_TRANSFER u2)
(define-constant TX_TYPE_ADD_MEMBER u3)
(define-constant TX_TYPE_REMOVE_MEMBER u4)
(define-constant TX_TYPE_UPDATE_THRESHOLD u5)
(define-constant TX_TYPE_PAUSE u6)
(define-constant TX_TYPE_UNPAUSE u7)

;; Transaction status (for reference)
(define-constant STATUS_PENDING u1)
(define-constant STATUS_APPROVED u2)
(define-constant STATUS_EXECUTED u3)
(define-constant STATUS_CANCELLED u4)
(define-constant STATUS_EXPIRED u5)

;; ============================================================================
;; ERROR CODES
;; ============================================================================

;; Initialization errors
(define-constant ERR_ALREADY_INITIALIZED u1001)
(define-constant ERR_WRONG_BOARD_SIZE u1002)
(define-constant ERR_ADD_MEMBERS_FAILED u1003)
(define-constant ERR_NOT_INITIALIZED u1004)

;; Authorization errors
(define-constant ERR_NOT_BOARD_MEMBER u1005)
(define-constant ERR_INVALID_AMOUNT u1006)

;; Transaction errors
(define-constant ERR_TX_NOT_FOUND u1007)
(define-constant ERR_ALREADY_APPROVED u1008)
(define-constant ERR_TX_EXECUTED u1009)
(define-constant ERR_INSUFFICIENT_APPROVALS u1010)
(define-constant ERR_LIST_TOO_LONG u1011)
(define-constant ERR_TOKEN_TRANSFER_FAILED u1012)
(define-constant ERR_TX_CANCELLED u1013)
(define-constant ERR_TX_EXPIRED u1014)
(define-constant ERR_NOT_APPROVED u1015)
(define-constant ERR_CONTRACT_PAUSED u1016)
(define-constant ERR_INVALID_THRESHOLD u1017)
(define-constant ERR_INVALID_PROPOSAL_TYPE u1018)
(define-constant ERR_BATCH_TOO_LARGE u1019)
(define-constant ERR_INVALID_MEMBER u1020)

