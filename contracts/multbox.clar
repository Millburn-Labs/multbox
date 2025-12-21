;; title: BoardMultiSig
;; version: 1.0.0
;; summary: Multi-signature wallet requiring majority approval from 20 board members
;; description: A secure multi-signature wallet contract that requires exactly 20 board members and majority approval (11/20) for transaction execution.

(define-constant BOARD_SIZE u20)
(define-constant MAJORITY_THRESHOLD u11)

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

;; Data maps
(define-map board-members principal bool)
;; Approval tracking: transaction-id -> list of approvers
(define-map transaction-approvers uint (list 20 principal))
(define-map transactions uint {
    proposer: principal,
    recipient: principal,
    amount: uint,
    token-contract: (optional principal),
    executed: bool,
    approval-count: uint
})

;; Data variables
(define-data-var next-transaction-id uint u0)
(define-data-var initialized bool false)
(define-data-var board-member-count uint u0)

;; Read-only functions

;; Check if a principal is a board member
(define-read-only (is-board-member (member principal))
    (map-get? board-members member)
)

;; Get the total number of board members
(define-read-only (get-board-member-count)
    (var-get board-member-count)
)

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

;; Check if contract is initialized
(define-read-only (is-initialized)
    (var-get initialized)
)

;; Public functions

;; Initialize the contract with exactly 20 board members
;; This can only be called once
(define-public (initialize (members (list 20 principal)))
    (let (
        (current-init (var-get initialized))
        (current-count (var-get board-member-count))
    )
        (asserts! (not current-init) (err u1001)) ;; Contract already initialized
        (asserts! (is-eq (len members) BOARD_SIZE) (err u1002)) ;; Must have exactly 20 members
        
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
        (err u1003)
    )
)

;; Propose a new transaction
;; Only board members can propose transactions
(define-public (propose-transaction 
    (recipient principal)
    (amount uint)
    (token-contract (optional principal))
)
    (let (
        (proposer tx-sender)
        (is-member (default-to false (map-get? board-members proposer)))
        (tx-id (var-get next-transaction-id))
    )
        (begin
            (asserts! (var-get initialized) (err u1004)) ;; Contract not initialized
            (asserts! is-member (err u1005)) ;; Only board members can propose
            (asserts! (not (is-eq amount u0)) (err u1006)) ;; Amount must be greater than 0
            
            ;; Create new transaction
            (map-insert transactions tx-id {
                proposer: proposer,
                recipient: recipient,
                amount: amount,
                token-contract: token-contract,
                executed: false,
                approval-count: u0
            })
            
            ;; Approval list will be created on first approval
            
            ;; Increment transaction ID
            (var-set next-transaction-id (+ tx-id u1))
            
            ;; Auto-approve by proposer
            (try! (approve-transaction-internal tx-id proposer))
            
            (ok tx-id)
        )
    )
)

;; Approve a transaction
;; Only board members can approve, and they can only approve once per transaction
(define-public (approve-transaction (tx-id uint))
    (let (
        (approver tx-sender)
        (is-member (default-to false (map-get? board-members approver)))
    )
        (asserts! (var-get initialized) (err u1004)) ;; Contract not initialized
        (asserts! is-member (err u1005)) ;; Only board members can approve
        (try! (approve-transaction-internal tx-id approver))
        (ok true)
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
        (asserts! (is-some tx-opt) (err u1007)) ;; Transaction does not exist
        (asserts! (not already-approved) (err u1008)) ;; Already approved
        
        (match tx-opt
            tx
            (let (
                (executed (get executed tx))
            )
                (asserts! (not executed) (err u1009)) ;; Transaction already executed
                
                ;; Add approver to the list
                (match approvers-opt
                    approvers
                    (try! (match (as-max-len? (append approvers approver) u20)
                        new-approvers 
                        (begin
                            (map-set transaction-approvers tx-id new-approvers)
                            (ok true)
                        )
                        (err u1011) ;; List too long (shouldn't happen)
                    ))
                    ;; First approval - create new list
                    (map-insert transaction-approvers tx-id (list approver))
                )
                
                ;; Increment approval count
                (let ((new-count (+ (get approval-count tx) u1)))
                    (map-set transactions tx-id {
                        proposer: (get proposer tx),
                        recipient: (get recipient tx),
                        amount: (get amount tx),
                        token-contract: (get token-contract tx),
                        executed: false,
                        approval-count: new-count
                    })
                    (ok true)
                )
            )
            (err u1007)
        )
    )
)

;; Execute a transaction
;; Can be called by anyone once majority approval is reached
(define-public (execute-transaction (tx-id uint))
    (let (
        (tx-opt (map-get? transactions tx-id))
    )
        (asserts! (var-get initialized) (err u1004)) ;; Contract not initialized
        (asserts! (is-some tx-opt) (err u1007)) ;; Transaction does not exist
        
        (match tx-opt
            tx
            (let (
                (executed (get executed tx))
                (approval-count (get approval-count tx))
                (recipient (get recipient tx))
                (amount (get amount tx))
                (token-contract (get token-contract tx))
            )
                (asserts! (not executed) (err u1009)) ;; Transaction already executed
                (asserts! (>= approval-count MAJORITY_THRESHOLD) (err u1010)) ;; Insufficient approvals
                
                ;; Mark as executed first to prevent reentrancy
                (map-set transactions tx-id {
                    proposer: (get proposer tx),
                    recipient: recipient,
                    amount: amount,
                    token-contract: token-contract,
                    executed: true,
                    approval-count: approval-count
                })
                
                ;; Execute the transfer
                (try! (match token-contract contract-principal
                    ;; For token transfers, the contract principal is stored
                    ;; but we need the contract identifier to call it
                    ;; For now, we'll support STX transfers only
                    ;; Token transfers would require the contract identifier string
                    (err u1012) ;; Token transfers not yet supported - use STX instead
                    ;; Transfer STX - contract must hold the STX balance
                    ;; Use as-contract to transfer from contract's balance
                    (as-contract (stx-transfer? amount tx-sender recipient))
                ))
                
                (ok true)
            )
            (err u1007)
        )
    )
)

;; Error codes:
;; u1001: Contract already initialized
;; u1002: Must have exactly 20 board members
;; u1003: Failed to add board members
;; u1004: Contract not initialized
;; u1005: Only board members can perform this action
;; u1006: Amount must be greater than 0
;; u1007: Transaction does not exist
;; u1008: Already approved this transaction
;; u1009: Transaction already executed
;; u1010: Insufficient approvals (need majority)
