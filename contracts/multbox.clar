;; title: BoardMultiSig
;; version: 2.0.0
;; summary: Multi-signature wallet requiring majority approval from 20 board members
;; description: A secure multi-signature wallet contract with advanced governance features including token support, transaction cancellation, pause mechanism, and more.

;; ============================================================================
;; CONSTANTS AND CONFIGURATION
;; ============================================================================

(define-constant BOARD_SIZE u20)
(define-constant DEFAULT_MAJORITY_THRESHOLD u11)
(define-constant HIGH_THRESHOLD u15) ;; For sensitive operations like board changes
(define-constant PROPOSAL_EXPIRY_DAYS u30) ;; 30 days in blocks (assuming ~1 block per 10 minutes = 4320 blocks)
(define-constant BLOCKS_PER_DAY u144) ;; Approximate blocks per day (144 blocks = 24 hours at 10 min/block)

;; ============================================================================
;; TRAITS
;; ============================================================================

;; SIP-010 Fungible Token trait
(define-trait SIP010Trait
    ((transfer (uint principal principal (optional (buff 34))) (response bool uint))
     (get-name () (response (string-ascii 32) uint))
     (get-symbol () (response (string-ascii 32) uint))
     (get-decimals () (response uint uint))
     (get-balance (principal) (response uint uint))
     (get-total-supply () (response uint uint))
     (get-token-uri () (response (optional (string-utf8 256)) uint))
))

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

;; ============================================================================
;; DATA STRUCTURES
;; ============================================================================

;; Transaction types
(define-constant TX_TYPE_TRANSFER u1)
(define-constant TX_TYPE_BATCH_TRANSFER u2)
(define-constant TX_TYPE_ADD_MEMBER u3)
(define-constant TX_TYPE_REMOVE_MEMBER u4)
(define-constant TX_TYPE_UPDATE_THRESHOLD u5)
(define-constant TX_TYPE_PAUSE u6)
(define-constant TX_TYPE_UNPAUSE u7)

;; Transaction status
(define-constant STATUS_PENDING u1)
(define-constant STATUS_APPROVED u2)
(define-constant STATUS_EXECUTED u3)
(define-constant STATUS_CANCELLED u4)
(define-constant STATUS_EXPIRED u5)

;; ============================================================================
;; STORAGE
;; ============================================================================

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
    ;; For batch transactions
    batch-transfers: (optional (list 10 {
        recipient: principal,
        amount: uint,
        token-contract: (optional principal)
    })),
    ;; For governance proposals
    new-member: (optional principal),
    threshold-value: (optional uint)
})

;; Approval tracking: transaction-id -> list of approvers
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

;; ============================================================================
;; READ-ONLY FUNCTIONS - BOARD MANAGEMENT
;; ============================================================================

;; Check if a principal is a board member
(define-read-only (is-board-member (member principal))
    (map-get? board-members member)
)

;; Get the total number of board members
(define-read-only (get-board-member-count)
    (var-get board-member-count)
)

;; ============================================================================
;; READ-ONLY FUNCTIONS - TRANSACTIONS
;; ============================================================================

;; Get transaction details
(define-read-only (get-transaction (tx-id uint))
    (map-get? transactions tx-id)
)

;; Get approval status for a specific transaction and member
(define-read-only (has-approved (tx-id uint) (member principal))
    (let ((approvers-opt (map-get? transaction-approvers tx-id)))
        (match approvers-opt
            approvers (is-some (index-of approvers member))
            false
        )
    )
)

;; Get the number of approvals for a transaction
(define-read-only (get-approval-count (tx-id uint))
    (match (map-get? transactions tx-id)
        tx (ok (get approval-count tx))
        (ok u0)
    )
)

;; Get list of approvers for a transaction
(define-read-only (get-approvers (tx-id uint))
    (map-get? transaction-approvers tx-id)
)

;; Check if transaction is expired
(define-read-only (is-transaction-expired (tx-id uint))
    (match (map-get? transactions tx-id)
        tx
        (let ((expires-at (get expires-at tx))
              (current-block (block-height)))
            (>= current-block expires-at)
        )
        false
    )
)

;; ============================================================================
;; READ-ONLY FUNCTIONS - STATISTICS
;; ============================================================================

;; Get total number of transactions
(define-read-only (get-total-transactions)
    (var-get total-transactions)
)

;; Get number of executed transactions
(define-read-only (get-executed-transactions)
    (var-get executed-transactions)
)

;; Get number of cancelled transactions
(define-read-only (get-cancelled-transactions)
    (var-get cancelled-transactions)
)

;; Get number of expired transactions
(define-read-only (get-expired-transactions)
    (var-get expired-transactions)
)

;; Get pending transactions count
(define-read-only (get-pending-transactions-count)
    (let ((total (var-get total-transactions))
          (executed (var-get executed-transactions))
          (cancelled (var-get cancelled-transactions))
          (expired (var-get expired-transactions)))
        (- total (+ executed cancelled expired))
    )
)

;; Get current approval threshold
(define-read-only (get-approval-threshold)
    (var-get approval-threshold)
)

;; Check if contract is paused
(define-read-only (is-paused)
    (var-get paused)
)

;; Check if contract is initialized
(define-read-only (is-initialized)
    (var-get initialized)
)

;; ============================================================================
;; PRIVATE HELPER FUNCTIONS
;; ============================================================================

;; Check if caller is a board member
(define-private (check-board-member (caller principal))
    (default-to false (map-get? board-members caller))
)

;; Check if contract is initialized
(define-private (check-initialized)
    (var-get initialized)
)

;; Check if contract is paused
(define-private (check-paused)
    (var-get paused)
)

;; Get current block height
(define-private (get-current-block)
    (block-height)
)

;; Calculate expiry block
(define-private (calculate-expiry (created-at uint))
    (+ created-at (* PROPOSAL_EXPIRY_DAYS BLOCKS_PER_DAY))
)

;; Check if transaction is valid for execution
(define-private (is-transaction-valid (tx {proposer: principal, tx-type: uint, recipient: principal, amount: uint, token-contract: (optional principal), executed: bool, cancelled: bool, approval-count: uint, created-at: uint, expires-at: uint, metadata: (optional (string-utf8 500)), batch-transfers: (optional (list 10 {recipient: principal, amount: uint, token-contract: (optional principal)})), new-member: (optional principal), threshold-value: (optional uint)}))
    (and
        (not (get executed tx))
        (not (get cancelled tx))
        (>= (get approval-count tx) (var-get approval-threshold))
        (<= (get-current-block) (get expires-at tx))
    )
)

;; ============================================================================
;; PUBLIC FUNCTIONS - INITIALIZATION
;; ============================================================================

;; Initialize the contract with exactly 20 board members
;; This can only be called once
(define-public (initialize (members (list 20 principal)))
    (let (
        (current-init (var-get initialized))
        (current-count (var-get board-member-count))
    )
        (asserts! (not current-init) (err ERR_ALREADY_INITIALIZED))
        (asserts! (is-eq (len members) BOARD_SIZE) (err ERR_WRONG_BOARD_SIZE))
        
        ;; Add all members to the board
        (try! (add-board-members members))
        
        ;; Mark as initialized
        (var-set initialized true)
        (ok true)
    )
)

;; Private helper function to add board members
(define-private (add-board-members (members (list 20 principal)))
    (match (as-max-len? members u20)
        members-list
        (begin
            (map-insert board-members (unwrap-panic (element-at members-list u0)) true)
            (map-insert board-members (unwrap-panic (element-at members-list u1)) true)
            (map-insert board-members (unwrap-panic (element-at members-list u2)) true)
            (map-insert board-members (unwrap-panic (element-at members-list u3)) true)
            (map-insert board-members (unwrap-panic (element-at members-list u4)) true)
            (map-insert board-members (unwrap-panic (element-at members-list u5)) true)
            (map-insert board-members (unwrap-panic (element-at members-list u6)) true)
            (map-insert board-members (unwrap-panic (element-at members-list u7)) true)
            (map-insert board-members (unwrap-panic (element-at members-list u8)) true)
            (map-insert board-members (unwrap-panic (element-at members-list u9)) true)
            (map-insert board-members (unwrap-panic (element-at members-list u10)) true)
            (map-insert board-members (unwrap-panic (element-at members-list u11)) true)
            (map-insert board-members (unwrap-panic (element-at members-list u12)) true)
            (map-insert board-members (unwrap-panic (element-at members-list u13)) true)
            (map-insert board-members (unwrap-panic (element-at members-list u14)) true)
            (map-insert board-members (unwrap-panic (element-at members-list u15)) true)
            (map-insert board-members (unwrap-panic (element-at members-list u16)) true)
            (map-insert board-members (unwrap-panic (element-at members-list u17)) true)
            (map-insert board-members (unwrap-panic (element-at members-list u18)) true)
            (map-insert board-members (unwrap-panic (element-at members-list u19)) true)
            (var-set board-member-count BOARD_SIZE)
            (ok true)
        )
        (err ERR_ADD_MEMBERS_FAILED)
    )
)

;; ============================================================================
;; PUBLIC FUNCTIONS - TRANSACTION PROPOSAL
;; ============================================================================

;; Propose a new transfer transaction (STX or SIP-010 token)
(define-public (propose-transaction 
    (recipient principal)
    (amount uint)
    (token-contract (optional principal))
    (metadata (optional (string-utf8 500)))
)
    (let (
        (proposer tx-sender)
        (is-member (check-board-member proposer))
        (tx-id (var-get next-transaction-id))
        (current-block (get-current-block))
        (expires-at (calculate-expiry current-block))
        (is-paused (check-paused))
    )
        (begin
            (asserts! (check-initialized) (err ERR_NOT_INITIALIZED))
            (asserts! (not is-paused) (err ERR_CONTRACT_PAUSED))
            (asserts! is-member (err ERR_NOT_BOARD_MEMBER))
            (asserts! (not (is-eq amount u0)) (err ERR_INVALID_AMOUNT))
            
            ;; Create new transaction
            (map-insert transactions tx-id {
                proposer: proposer,
                tx-type: TX_TYPE_TRANSFER,
                recipient: recipient,
                amount: amount,
                token-contract: token-contract,
                executed: false,
                cancelled: false,
                approval-count: u0,
                created-at: current-block,
                expires-at: expires-at,
                metadata: metadata,
                batch-transfers: none,
                new-member: none,
                threshold-value: none
            })
            
            ;; Increment transaction ID and total count
            (var-set next-transaction-id (+ tx-id u1))
            (var-set total-transactions (+ (var-get total-transactions) u1))
            
            ;; Auto-approve by proposer
            (try! (approve-transaction-internal tx-id proposer))
            
            (print {event: "transaction-proposed", tx-id: tx-id, proposer: proposer, recipient: recipient, amount: amount})
            (ok tx-id)
        )
    )
)

;; Propose a batch transaction (multiple transfers in one proposal)
(define-public (propose-batch-transaction
    (transfers (list 10 {
        recipient: principal,
        amount: uint,
        token-contract: (optional principal)
    }))
    (metadata (optional (string-utf8 500)))
)
    (let (
        (proposer tx-sender)
        (is-member (check-board-member proposer))
        (tx-id (var-get next-transaction-id))
        (current-block (get-current-block))
        (expires-at (calculate-expiry current-block))
        (is-paused (check-paused))
        (transfer-count (len transfers))
    )
        (begin
            (asserts! (check-initialized) (err ERR_NOT_INITIALIZED))
            (asserts! (not is-paused) (err ERR_CONTRACT_PAUSED))
            (asserts! is-member (err ERR_NOT_BOARD_MEMBER))
            (asserts! (> transfer-count u0) (err ERR_BATCH_TOO_LARGE))
            (asserts! (<= transfer-count u10) (err ERR_BATCH_TOO_LARGE))
            
            ;; Create new batch transaction
            (map-insert transactions tx-id {
                proposer: proposer,
                tx-type: TX_TYPE_BATCH_TRANSFER,
                recipient: proposer, ;; Not used for batch, but required
                amount: u0, ;; Not used for batch, but required
                token-contract: none,
                executed: false,
                cancelled: false,
                approval-count: u0,
                created-at: current-block,
                expires-at: expires-at,
                metadata: metadata,
                batch-transfers: (some transfers),
                new-member: none,
                threshold-value: none
            })
            
            ;; Increment transaction ID and total count
            (var-set next-transaction-id (+ tx-id u1))
            (var-set total-transactions (+ (var-get total-transactions) u1))
            
            ;; Auto-approve by proposer
            (try! (approve-transaction-internal tx-id proposer))
            
            (print {event: "batch-transaction-proposed", tx-id: tx-id, proposer: proposer, transfer-count: transfer-count})
            (ok tx-id)
        )
    )
)

;; Propose adding a board member
(define-public (propose-add-member
    (new-member principal)
    (metadata (optional (string-utf8 500)))
)
    (let (
        (proposer tx-sender)
        (is-member (check-board-member proposer))
        (tx-id (var-get next-transaction-id))
        (current-block (get-current-block))
        (expires-at (calculate-expiry current-block))
        (is-paused (check-paused))
        (already-member (check-board-member new-member))
    )
        (begin
            (asserts! (check-initialized) (err ERR_NOT_INITIALIZED))
            (asserts! (not is-paused) (err ERR_CONTRACT_PAUSED))
            (asserts! is-member (err ERR_NOT_BOARD_MEMBER))
            (asserts! (not already-member) (err ERR_INVALID_MEMBER))
            
            ;; Create governance proposal
            (map-insert transactions tx-id {
                proposer: proposer,
                tx-type: TX_TYPE_ADD_MEMBER,
                recipient: proposer,
                amount: u0,
                token-contract: none,
                executed: false,
                cancelled: false,
                approval-count: u0,
                created-at: current-block,
                expires-at: expires-at,
                metadata: metadata,
                batch-transfers: none,
                new-member: (some new-member),
                threshold-value: none
            })
            
            ;; Increment transaction ID and total count
            (var-set next-transaction-id (+ tx-id u1))
            (var-set total-transactions (+ (var-get total-transactions) u1))
            
            ;; Auto-approve by proposer
            (try! (approve-transaction-internal tx-id proposer))
            
            (print {event: "add-member-proposed", tx-id: tx-id, proposer: proposer, new-member: new-member})
            (ok tx-id)
        )
    )
)

;; Propose removing a board member
(define-public (propose-remove-member
    (member-to-remove principal)
    (metadata (optional (string-utf8 500)))
)
    (let (
        (proposer tx-sender)
        (is-member (check-board-member proposer))
        (tx-id (var-get next-transaction-id))
        (current-block (get-current-block))
        (expires-at (calculate-expiry current-block))
        (is-paused (check-paused))
        (is-member-to-remove (check-board-member member-to-remove))
    )
        (begin
            (asserts! (check-initialized) (err ERR_NOT_INITIALIZED))
            (asserts! (not is-paused) (err ERR_CONTRACT_PAUSED))
            (asserts! is-member (err ERR_NOT_BOARD_MEMBER))
            (asserts! is-member-to-remove (err ERR_INVALID_MEMBER))
            
            ;; Create governance proposal
            (map-insert transactions tx-id {
                proposer: proposer,
                tx-type: TX_TYPE_REMOVE_MEMBER,
                recipient: proposer,
                amount: u0,
                token-contract: none,
                executed: false,
                cancelled: false,
                approval-count: u0,
                created-at: current-block,
                expires-at: expires-at,
                metadata: metadata,
                batch-transfers: none,
                new-member: (some member-to-remove),
                threshold-value: none
            })
            
            ;; Increment transaction ID and total count
            (var-set next-transaction-id (+ tx-id u1))
            (var-set total-transactions (+ (var-get total-transactions) u1))
            
            ;; Auto-approve by proposer
            (try! (approve-transaction-internal tx-id proposer))
            
            (print {event: "remove-member-proposed", tx-id: tx-id, proposer: proposer, member-to-remove: member-to-remove})
            (ok tx-id)
        )
    )
)

;; Propose updating approval threshold
(define-public (propose-update-threshold
    (new-threshold uint)
    (metadata (optional (string-utf8 500)))
)
    (let (
        (proposer tx-sender)
        (is-member (check-board-member proposer))
        (tx-id (var-get next-transaction-id))
        (current-block (get-current-block))
        (expires-at (calculate-expiry current-block))
        (is-paused (check-paused))
    )
        (begin
            (asserts! (check-initialized) (err ERR_NOT_INITIALIZED))
            (asserts! (not is-paused) (err ERR_CONTRACT_PAUSED))
            (asserts! is-member (err ERR_NOT_BOARD_MEMBER))
            (asserts! (> new-threshold u0) (err ERR_INVALID_THRESHOLD))
            (asserts! (<= new-threshold BOARD_SIZE) (err ERR_INVALID_THRESHOLD))
            
            ;; Create governance proposal
            (map-insert transactions tx-id {
                proposer: proposer,
                tx-type: TX_TYPE_UPDATE_THRESHOLD,
                recipient: proposer,
                amount: u0,
                token-contract: none,
                executed: false,
                cancelled: false,
                approval-count: u0,
                created-at: current-block,
                expires-at: expires-at,
                metadata: metadata,
                batch-transfers: none,
                new-member: none,
                threshold-value: (some new-threshold)
            })
            
            ;; Increment transaction ID and total count
            (var-set next-transaction-id (+ tx-id u1))
            (var-set total-transactions (+ (var-get total-transactions) u1))
            
            ;; Auto-approve by proposer
            (try! (approve-transaction-internal tx-id proposer))
            
            (print {event: "update-threshold-proposed", tx-id: tx-id, proposer: proposer, new-threshold: new-threshold})
            (ok tx-id)
        )
    )
)

;; Propose pause
(define-public (propose-pause
    (metadata (optional (string-utf8 500)))
)
    (let (
        (proposer tx-sender)
        (is-member (check-board-member proposer))
        (tx-id (var-get next-transaction-id))
        (current-block (get-current-block))
        (expires-at (calculate-expiry current-block))
        (is-paused (check-paused))
    )
        (begin
            (asserts! (check-initialized) (err ERR_NOT_INITIALIZED))
            (asserts! (not is-paused) (err ERR_CONTRACT_PAUSED))
            (asserts! is-member (err ERR_NOT_BOARD_MEMBER))
            
            ;; Create governance proposal
            (map-insert transactions tx-id {
                proposer: proposer,
                tx-type: TX_TYPE_PAUSE,
                recipient: proposer,
                amount: u0,
                token-contract: none,
                executed: false,
                cancelled: false,
                approval-count: u0,
                created-at: current-block,
                expires-at: expires-at,
                metadata: metadata,
                batch-transfers: none,
                new-member: none,
                threshold-value: none
            })
            
            ;; Increment transaction ID and total count
            (var-set next-transaction-id (+ tx-id u1))
            (var-set total-transactions (+ (var-get total-transactions) u1))
            
            ;; Auto-approve by proposer
            (try! (approve-transaction-internal tx-id proposer))
            
            (print {event: "pause-proposed", tx-id: tx-id, proposer: proposer})
            (ok tx-id)
        )
    )
)

;; Propose unpause
(define-public (propose-unpause
    (metadata (optional (string-utf8 500)))
)
    (let (
        (proposer tx-sender)
        (is-member (check-board-member proposer))
        (tx-id (var-get next-transaction-id))
        (current-block (get-current-block))
        (expires-at (calculate-expiry current-block))
        (is-paused (check-paused))
    )
        (begin
            (asserts! (check-initialized) (err ERR_NOT_INITIALIZED))
            (asserts! is-paused (err ERR_CONTRACT_PAUSED))
            (asserts! is-member (err ERR_NOT_BOARD_MEMBER))
            
            ;; Create governance proposal
            (map-insert transactions tx-id {
                proposer: proposer,
                tx-type: TX_TYPE_UNPAUSE,
                recipient: proposer,
                amount: u0,
                token-contract: none,
                executed: false,
                cancelled: false,
                approval-count: u0,
                created-at: current-block,
                expires-at: expires-at,
                metadata: metadata,
                batch-transfers: none,
                new-member: none,
                threshold-value: none
            })
            
            ;; Increment transaction ID and total count
            (var-set next-transaction-id (+ tx-id u1))
            (var-set total-transactions (+ (var-get total-transactions) u1))
            
            ;; Auto-approve by proposer
            (try! (approve-transaction-internal tx-id proposer))
            
            (print {event: "unpause-proposed", tx-id: tx-id, proposer: proposer})
            (ok tx-id)
        )
    )
)

;; ============================================================================
;; PUBLIC FUNCTIONS - APPROVAL MANAGEMENT
;; ============================================================================

;; Approve a transaction
;; Only board members can approve, and they can only approve once per transaction
(define-public (approve-transaction (tx-id uint))
    (let (
        (approver tx-sender)
        (is-member (check-board-member approver))
        (is-paused (check-paused))
    )
        (begin
            (asserts! (check-initialized) (err ERR_NOT_INITIALIZED))
            (asserts! (not is-paused) (err ERR_CONTRACT_PAUSED))
            (asserts! is-member (err ERR_NOT_BOARD_MEMBER))
            (try! (approve-transaction-internal tx-id approver))
            (print {event: "transaction-approved", tx-id: tx-id, approver: approver})
            (ok true)
        )
    )
)

;; Revoke approval (withdraw approval before execution)
(define-public (revoke-approval (tx-id uint))
    (let (
        (approver tx-sender)
        (is-member (check-board-member approver))
        (is-paused (check-paused))
    )
        (begin
            (asserts! (check-initialized) (err ERR_NOT_INITIALIZED))
            (asserts! (not is-paused) (err ERR_CONTRACT_PAUSED))
            (asserts! is-member (err ERR_NOT_BOARD_MEMBER))
            (try! (revoke-approval-internal tx-id approver))
            (print {event: "approval-revoked", tx-id: tx-id, approver: approver})
            (ok true)
        )
    )
)

;; Internal function to handle approval logic
(define-private (approve-transaction-internal (tx-id uint) (approver principal))
    (let (
        (tx-opt (map-get? transactions tx-id))
        (approvers-opt (map-get? transaction-approvers tx-id))
        (already-approved (match approvers-opt
            approvers (is-some (index-of approvers approver))
            false
        ))
    )
        (asserts! (is-some tx-opt) (err ERR_TX_NOT_FOUND))
        (asserts! (not already-approved) (err ERR_ALREADY_APPROVED))
        
        (match tx-opt
            tx
            (let (
                (executed (get executed tx))
                (cancelled (get cancelled tx))
                (expires-at (get expires-at tx))
                (current-block (get-current-block))
            )
                (asserts! (not executed) (err ERR_TX_EXECUTED))
                (asserts! (not cancelled) (err ERR_TX_CANCELLED))
                (asserts! (<= current-block expires-at) (err ERR_TX_EXPIRED))
                
                ;; Add approver to the list
                (match approvers-opt
                    approvers
                    (try! (match (as-max-len? (append approvers approver) u20)
                        new-approvers 
                        (begin
                            (map-set transaction-approvers tx-id new-approvers)
                            (ok true)
                        )
                        (err ERR_LIST_TOO_LONG)
                    ))
                    ;; First approval - create new list
                    (map-insert transaction-approvers tx-id (list approver))
                )
                
                ;; Increment approval count
                (let ((new-count (+ (get approval-count tx) u1)))
                    (map-set transactions tx-id {
                        proposer: (get proposer tx),
                        tx-type: (get tx-type tx),
                        recipient: (get recipient tx),
                        amount: (get amount tx),
                        token-contract: (get token-contract tx),
                        executed: false,
                        cancelled: false,
                        approval-count: new-count,
                        created-at: (get created-at tx),
                        expires-at: expires-at,
                        metadata: (get metadata tx),
                        batch-transfers: (get batch-transfers tx),
                        new-member: (get new-member tx),
                        threshold-value: (get threshold-value tx)
                    })
                    (ok true)
                )
            )
            (err ERR_TX_NOT_FOUND)
        )
    )
)

;; Internal function to handle revoke approval logic
(define-private (revoke-approval-internal (tx-id uint) (approver principal))
    (let (
        (tx-opt (map-get? transactions tx-id))
        (approvers-opt (map-get? transaction-approvers tx-id))
    )
        (asserts! (is-some tx-opt) (err ERR_TX_NOT_FOUND))
        
        (match approvers-opt
            approvers
            (let ((approver-index (index-of approvers approver)))
                (asserts! (is-some approver-index) (err ERR_NOT_APPROVED))
                
                (match tx-opt
                    tx
                    (let (
                        (executed (get executed tx))
                        (cancelled (get cancelled tx))
                    )
                        (asserts! (not executed) (err ERR_TX_EXECUTED))
                        (asserts! (not cancelled) (err ERR_TX_CANCELLED))
                        
                        ;; Remove approver from list
                        (let ((new-approvers (filter approvers (lambda (member) (not (is-eq member approver))))))
                            (match (as-max-len? new-approvers u20)
                                filtered-approvers
                                (begin
                                    (map-set transaction-approvers tx-id filtered-approvers)
                                    
                                    ;; Decrement approval count
                                    (let ((new-count (- (get approval-count tx) u1)))
                                        (map-set transactions tx-id {
                                            proposer: (get proposer tx),
                                            tx-type: (get tx-type tx),
                                            recipient: (get recipient tx),
                                            amount: (get amount tx),
                                            token-contract: (get token-contract tx),
                                            executed: false,
                                            cancelled: false,
                                            approval-count: new-count,
                                            created-at: (get created-at tx),
                                            expires-at: (get expires-at tx),
                                            metadata: (get metadata tx),
                                            batch-transfers: (get batch-transfers tx),
                                            new-member: (get new-member tx),
                                            threshold-value: (get threshold-value tx)
                                        })
                                        (ok true)
                                    )
                                )
                                (err ERR_LIST_TOO_LONG)
                            )
                        )
                    )
                    (err ERR_TX_NOT_FOUND)
                )
            )
            (err ERR_NOT_APPROVED)
        )
    )
)

;; ============================================================================
;; PUBLIC FUNCTIONS - TRANSACTION EXECUTION
;; ============================================================================

;; Execute a transaction
;; Can be called by anyone once majority approval is reached
(define-public (execute-transaction (tx-id uint))
    (let (
        (tx-opt (map-get? transactions tx-id))
        (is-paused (check-paused))
    )
        (begin
            (asserts! (check-initialized) (err ERR_NOT_INITIALIZED))
            (asserts! (not is-paused) (err ERR_CONTRACT_PAUSED))
            (asserts! (is-some tx-opt) (err ERR_TX_NOT_FOUND))
            
            (match tx-opt
                tx
                (let (
                    (executed (get executed tx))
                    (cancelled (get cancelled tx))
                    (approval-count (get approval-count tx))
                    (expires-at (get expires-at tx))
                    (current-block (get-current-block))
                    (tx-type (get tx-type tx))
                )
                    (asserts! (not executed) (err ERR_TX_EXECUTED))
                    (asserts! (not cancelled) (err ERR_TX_CANCELLED))
                    (asserts! (<= current-block expires-at) (err ERR_TX_EXPIRED))
                    
                    ;; Check threshold based on transaction type
                    (let ((required-threshold (if (or (is-eq tx-type TX_TYPE_ADD_MEMBER) (is-eq tx-type TX_TYPE_REMOVE_MEMBER) (is-eq tx-type TX_TYPE_UPDATE_THRESHOLD) (is-eq tx-type TX_TYPE_PAUSE) (is-eq tx-type TX_TYPE_UNPAUSE))
                        HIGH_THRESHOLD
                        (var-get approval-threshold)
                    )))
                        (asserts! (>= approval-count required-threshold) (err ERR_INSUFFICIENT_APPROVALS))
                        
                        ;; Mark as executed first to prevent reentrancy
                        (map-set transactions tx-id {
                            proposer: (get proposer tx),
                            tx-type: tx-type,
                            recipient: (get recipient tx),
                            amount: (get amount tx),
                            token-contract: (get token-contract tx),
                            executed: true,
                            cancelled: false,
                            approval-count: approval-count,
                            created-at: (get created-at tx),
                            expires-at: expires-at,
                            metadata: (get metadata tx),
                            batch-transfers: (get batch-transfers tx),
                            new-member: (get new-member tx),
                            threshold-value: (get threshold-value tx)
                        })
                        
                        ;; Execute based on transaction type
                        (try! (execute-transaction-by-type tx))
                        
                        ;; Update statistics
                        (var-set executed-transactions (+ (var-get executed-transactions) u1))
                        
                        (print {event: "transaction-executed", tx-id: tx-id, tx-type: tx-type})
                        (ok true)
                    )
                )
                (err ERR_TX_NOT_FOUND)
            )
        )
    )
)

;; Execute transaction based on type
(define-private (execute-transaction-by-type (tx {proposer: principal, tx-type: uint, recipient: principal, amount: uint, token-contract: (optional principal), executed: bool, cancelled: bool, approval-count: uint, created-at: uint, expires-at: uint, metadata: (optional (string-utf8 500)), batch-transfers: (optional (list 10 {recipient: principal, amount: uint, token-contract: (optional principal)})), new-member: (optional principal), threshold-value: (optional uint)}))
    (let ((tx-type (get tx-type tx)))
        (match tx-type
            TX_TYPE_TRANSFER (try! (execute-transfer tx))
            TX_TYPE_BATCH_TRANSFER (try! (execute-batch-transfer tx))
            TX_TYPE_ADD_MEMBER (try! (execute-add-member tx))
            TX_TYPE_REMOVE_MEMBER (try! (execute-remove-member tx))
            TX_TYPE_UPDATE_THRESHOLD (try! (execute-update-threshold tx))
            TX_TYPE_PAUSE (try! (execute-pause))
            TX_TYPE_UNPAUSE (try! (execute-unpause))
            (err ERR_INVALID_PROPOSAL_TYPE)
        )
    )
)

;; Execute a single transfer
(define-private (execute-transfer (tx {proposer: principal, tx-type: uint, recipient: principal, amount: uint, token-contract: (optional principal), executed: bool, cancelled: bool, approval-count: uint, created-at: uint, expires-at: uint, metadata: (optional (string-utf8 500)), batch-transfers: (optional (list 10 {recipient: principal, amount: uint, token-contract: (optional principal)})), new-member: (optional principal), threshold-value: (optional uint)}))
    (let (
        (recipient (get recipient tx))
        (amount (get amount tx))
        (token-contract (get token-contract tx))
    )
        (match token-contract contract-principal
            ;; Token transfer using SIP-010 - call transfer function directly
            ;; Note: The token contract must implement SIP-010 trait
            (match (contract-call? contract-principal transfer amount tx-sender recipient none)
                (ok result) (ok true)
                (err error-code) (err ERR_TOKEN_TRANSFER_FAILED)
            )
            ;; STX transfer
            (stx-transfer? amount tx-sender recipient)
        )
    )
)

;; Execute batch transfer
(define-private (execute-batch-transfer (tx {proposer: principal, tx-type: uint, recipient: principal, amount: uint, token-contract: (optional principal), executed: bool, cancelled: bool, approval-count: uint, created-at: uint, expires-at: uint, metadata: (optional (string-utf8 500)), batch-transfers: (optional (list 10 {recipient: principal, amount: uint, token-contract: (optional principal)})), new-member: (optional principal), threshold-value: (optional uint)}))
    (match (get batch-transfers tx)
        transfers
        (begin
            (try! (execute-batch-transfers transfers u0))
            (ok true)
        )
        (err ERR_TX_NOT_FOUND)
    )
)

;; Helper to execute batch transfers recursively
(define-private (execute-batch-transfers (transfers (list 10 {recipient: principal, amount: uint, token-contract: (optional principal)})) (index uint))
    (if (>= index (len transfers))
        (ok true)
        (let ((transfer (unwrap-panic (element-at transfers index))))
            (begin
                (try! (execute-single-transfer 
                    (get recipient transfer)
                    (get amount transfer)
                    (get token-contract transfer)
                ))
                (try! (execute-batch-transfers transfers (+ index u1)))
                (ok true)
            )
        )
    )
)

;; Execute a single transfer from batch
(define-private (execute-single-transfer (recipient principal) (amount uint) (token-contract (optional principal)))
    (match token-contract contract-principal
        ;; Token transfer using SIP-010 - call transfer function directly
        (match (contract-call? contract-principal transfer amount tx-sender recipient none)
            (ok result) (ok true)
            (err error-code) (err ERR_TOKEN_TRANSFER_FAILED)
        )
        ;; STX transfer
        (stx-transfer? amount tx-sender recipient)
    )
)

;; Execute add member
(define-private (execute-add-member (tx {proposer: principal, tx-type: uint, recipient: principal, amount: uint, token-contract: (optional principal), executed: bool, cancelled: bool, approval-count: uint, created-at: uint, expires-at: uint, metadata: (optional (string-utf8 500)), batch-transfers: (optional (list 10 {recipient: principal, amount: uint, token-contract: (optional principal)})), new-member: (optional principal), threshold-value: (optional uint)}))
    (match (get new-member tx)
        new-member-principal
        (begin
            (map-insert board-members new-member-principal true)
            (var-set board-member-count (+ (var-get board-member-count) u1))
            (ok true)
        )
        (err ERR_INVALID_MEMBER)
    )
)

;; Execute remove member
(define-private (execute-remove-member (tx {proposer: principal, tx-type: uint, recipient: principal, amount: uint, token-contract: (optional principal), executed: bool, cancelled: bool, approval-count: uint, created-at: uint, expires-at: uint, metadata: (optional (string-utf8 500)), batch-transfers: (optional (list 10 {recipient: principal, amount: uint, token-contract: (optional principal)})), new-member: (optional principal), threshold-value: (optional uint)}))
    (match (get new-member tx)
        member-to-remove
        (begin
            (map-delete board-members member-to-remove)
            (var-set board-member-count (- (var-get board-member-count) u1))
            (ok true)
        )
        (err ERR_INVALID_MEMBER)
    )
)

;; Execute update threshold
(define-private (execute-update-threshold (tx {proposer: principal, tx-type: uint, recipient: principal, amount: uint, token-contract: (optional principal), executed: bool, cancelled: bool, approval-count: uint, created-at: uint, expires-at: uint, metadata: (optional (string-utf8 500)), batch-transfers: (optional (list 10 {recipient: principal, amount: uint, token-contract: (optional principal)})), new-member: (optional principal), threshold-value: (optional uint)}))
    (match (get threshold-value tx)
        new-threshold
        (begin
            (var-set approval-threshold new-threshold)
            (ok true)
        )
        (err ERR_INVALID_THRESHOLD)
    )
)

;; Execute pause
(define-private (execute-pause)
    (begin
        (var-set paused true)
        (ok true)
    )
)

;; Execute unpause
(define-private (execute-unpause)
    (begin
        (var-set paused false)
        (ok true)
    )
)

;; ============================================================================
;; PUBLIC FUNCTIONS - TRANSACTION CANCELLATION
;; ============================================================================

;; Cancel a transaction
;; Can be called by proposer or with majority approval
(define-public (cancel-transaction (tx-id uint))
    (let (
        (caller tx-sender)
        (is-member (check-board-member caller))
        (tx-opt (map-get? transactions tx-id))
        (is-paused (check-paused))
    )
        (begin
            (asserts! (check-initialized) (err ERR_NOT_INITIALIZED))
            (asserts! (not is-paused) (err ERR_CONTRACT_PAUSED))
            (asserts! (is-some tx-opt) (err ERR_TX_NOT_FOUND))
            
            (match tx-opt
                tx
                (let (
                    (proposer (get proposer tx))
                    (executed (get executed tx))
                    (cancelled (get cancelled tx))
                    (approval-count (get approval-count tx))
                    (is-proposer (is-eq caller proposer))
                )
                    (asserts! (not executed) (err ERR_TX_EXECUTED))
                    (asserts! (not cancelled) (err ERR_TX_CANCELLED))
                    (asserts! (or is-proposer (>= approval-count (var-get approval-threshold))) (err ERR_INSUFFICIENT_APPROVALS))
                    
                    ;; Mark as cancelled
                    (map-set transactions tx-id {
                        proposer: proposer,
                        tx-type: (get tx-type tx),
                        recipient: (get recipient tx),
                        amount: (get amount tx),
                        token-contract: (get token-contract tx),
                        executed: false,
                        cancelled: true,
                        approval-count: approval-count,
                        created-at: (get created-at tx),
                        expires-at: (get expires-at tx),
                        metadata: (get metadata tx),
                        batch-transfers: (get batch-transfers tx),
                        new-member: (get new-member tx),
                        threshold-value: (get threshold-value tx)
                    })
                    
                    ;; Update statistics
                    (var-set cancelled-transactions (+ (var-get cancelled-transactions) u1))
                    
                    (print {event: "transaction-cancelled", tx-id: tx-id, cancelled-by: caller})
                    (ok true)
                )
                (err ERR_TX_NOT_FOUND)
            )
        )
    )
)
