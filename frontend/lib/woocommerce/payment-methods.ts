/**
 * Must match Cofeo_Gateway_Bank_Transfer::ID in
 * wordpress/custom-plugin/checkout/class-cofeo-bank-transfer-gateway.php.
 * Kept as a single shared constant so PaymentSection and
 * OrderConfirmation can never drift from each other on this id.
 */
export const BANK_TRANSFER_METHOD_ID = "cofeo_bank_transfer";
