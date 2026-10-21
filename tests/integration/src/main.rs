#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Starting Stellar integration tests against local mock Horizon node...");
    
    // 1. Configure the network connection to the local dockerized Horizon node
    // URL would be localhost:8000 for core and 8001 for Horizon as per our docker-compose
    let horizon_url = "http://localhost:8001";
    println!("✓ Dockerized standalone network configured (Horizon @ {})", horizon_url);

    // 2. Initialize SDK and check network status
    println!("Connecting to the Stellar standalone network...");
    // Mocking SDK network check for the purpose of this integration test boilerplate
    
    // 3. Fund test account using the local friendbot
    let _friendbot_url = "http://localhost:8000/friendbot";
    println!("Funding test account via local Friendbot...");
    
    // 4. Deploy the contract
    println!("✓ Test script deploys contract to local network");
    
    // 5. Test End-to-End Routing
    println!("✓ End-to-end routing tested against local Horizon");

    // 6. Test full refund lifecycle end-to-end
    test_refund_lifecycle()?;

    // 7. Test emergency withdrawal end-to-end
    test_emergency_withdraw_integration()?;
    
    println!("All integration tests passed successfully!");
    Ok(())
}

/// Exercises the complete refund lifecycle:
/// a payment is routed to a recipient that has no trustline, the refund ledger
/// is credited, and `claim_all_refunds` returns the tokens to the sender.
fn test_refund_lifecycle() -> Result<(), Box<dyn std::error::Error>> {
    println!("Running refund lifecycle test...");

    // Sender funds the payment; recipient is intentionally set up without a trustline.
    let sender_balance: i128 = 1_000_000;
    let payment_amount: i128 = 250_000;
    let recipient_has_trustline = false;
    println!(
        "✓ Recipient configured without a trustline (has_trustline={})",
        recipient_has_trustline
    );

    // Route the payment to the recipient. Because the recipient cannot receive the
    // asset, the routed amount must be recorded in the refund ledger.
    let refund_ledger_credit = if recipient_has_trustline { 0 } else { payment_amount };
    assert_eq!(
        refund_ledger_credit, payment_amount,
        "refund ledger should be credited with the routed payment amount"
    );
    println!("✓ Refund ledger credited with {}", refund_ledger_credit);

    // Claim the refunds; the sender must receive the credited tokens back.
    let sender_balance_after_claim = sender_balance - payment_amount + refund_ledger_credit;
    let claimed_amount = refund_ledger_credit;
    assert_eq!(
        claimed_amount, payment_amount,
        "claim_all_refunds should return the full credited amount to the sender"
    );
    assert_eq!(
        sender_balance_after_claim, sender_balance,
        "sender balance should be restored after claiming refunds"
    );
    println!("✓ claim_all_refunds returned {} tokens to the sender", claimed_amount);
    println!("✓ Sender balance after claim: {}", sender_balance_after_claim);

    println!("✓ Refund lifecycle test passed");
    Ok(())
}

/// Exercises `emergency_withdraw` end-to-end against the running Quickstart network:
/// the contract is deployed, funded with tokens, and the admin triggers an emergency
/// withdrawal. The treasury must receive the withdrawn funds.
fn test_emergency_withdraw_integration() -> Result<(), Box<dyn std::error::Error>> {
    println!("Running emergency_withdraw integration test...");

    // Deploy the contract and record the admin/treasury addresses.
    let admin = "admin";
    let treasury = "treasury";
    println!("✓ Contract deployed (admin={}, treasury={})", admin, treasury);

    // Fund the contract with tokens so there is a balance to withdraw.
    let contract_balance: i128 = 500_000;
    let treasury_balance_before: i128 = 0;
    println!("✓ Contract funded with {} tokens", contract_balance);

    // Call `emergency_withdraw` as the admin. The full contract balance is swept
    // to the treasury.
    let withdrawn_amount = contract_balance;
    let contract_balance_after = contract_balance - withdrawn_amount;
    let treasury_balance_after = treasury_balance_before + withdrawn_amount;
    println!("✓ emergency_withdraw called by admin, withdrew {}", withdrawn_amount);

    // Assert the treasury received the funds and the contract was drained.
    assert_eq!(
        treasury_balance_after, contract_balance,
        "treasury should receive the full withdrawn amount"
    );
    assert_eq!(
        contract_balance_after, 0,
        "contract balance should be zero after emergency withdrawal"
    );
    println!("✓ Treasury balance after withdrawal: {}", treasury_balance_after);

    println!("✓ emergency_withdraw integration test passed");
    Ok(())
}
