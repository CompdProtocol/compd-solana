//! Native execution of Anchor dispatch/account validation. No transaction signatures or RPC.
use super::*;
use anchor_lang::solana_program::program_stubs::{set_syscall_stubs, SyscallStubs};
use anchor_lang::InstructionData;
struct RentSyscall;
impl SyscallStubs for RentSyscall {
    fn sol_get_rent_sysvar(&self, output: *mut u8) -> u64 {
        // The host-test syscall writes the same Rent representation expected by Solana.
        unsafe { std::ptr::write(output as *mut Rent, Rent::default()) };
        0
    }
}
fn release_case(
    signer: bool,
    correct_authority: bool,
    correct_recipient: bool,
    amount: u64,
) -> (bool, u64, u64, u64) {
    let authority = Pubkey::new_from_array([1; 32]);
    let presented = if correct_authority {
        authority
    } else {
        Pubkey::new_from_array([4; 32])
    };
    let recipient = Pubkey::new_from_array([2; 32]);
    let destination = if correct_recipient {
        recipient
    } else {
        Pubkey::new_from_array([3; 32])
    };
    let (address, bump) =
        Pubkey::find_program_address(&[b"treasury", authority.as_ref()], &crate::ID);
    let state = Treasury {
        authority,
        mint: Pubkey::new_from_array([5; 32]),
        executor: Pubkey::new_from_array([6; 32]),
        buyback_recipient: recipient,
        reserve_recipient: recipient,
        strategy: 350,
        buyback: 100,
        rewards: 0,
        reserve: 500,
        deployed: 0,
        event_nonce: 0,
        receipt_nonce: 0,
        run_nonce: 0,
        distribution_nonce: 0,
        runs: 0,
        paused: false,
        bump,
    };
    let mut data = vec![0u8; 8 + Treasury::INIT_SPACE];
    state.try_serialize(&mut data.as_mut_slice()).unwrap();
    let rent = Rent::default().minimum_balance(data.len());
    let mut treasury_lamports = rent + 950;
    let mut authority_lamports = 1000;
    let mut recipient_lamports = 0;
    let mut authority_data = [];
    let mut recipient_data = [];
    let system = anchor_lang::system_program::ID;
    let result = {
        let accounts = [
            AccountInfo::new(
                &presented,
                signer,
                false,
                &mut authority_lamports,
                &mut authority_data,
                &system,
                false,
                0,
            ),
            AccountInfo::new(
                &address,
                false,
                true,
                &mut treasury_lamports,
                &mut data,
                &crate::ID,
                false,
                0,
            ),
            AccountInfo::new(
                &destination,
                false,
                true,
                &mut recipient_lamports,
                &mut recipient_data,
                &system,
                false,
                0,
            ),
        ];
        crate::entry(
            &crate::ID,
            &accounts,
            &crate::instruction::ReleaseReserve {
                buyback: true,
                amount,
            }
            .data(),
        )
        .is_ok()
    };
    let loaded = Treasury::try_deserialize(&mut data.as_slice()).unwrap();
    (
        result,
        loaded.buyback,
        treasury_lamports - rent,
        recipient_lamports,
    )
}
#[test]
fn anchor_dispatch_enforces_signer_identity_destination_and_custody() {
    let previous = set_syscall_stubs(Box::new(RentSyscall));
    assert_eq!(release_case(true, true, true, 50), (true, 50, 900, 50));
    assert_eq!(release_case(false, true, true, 50), (false, 100, 950, 0));
    assert_eq!(release_case(true, false, true, 50), (false, 100, 950, 0));
    assert_eq!(release_case(true, true, false, 50), (false, 100, 950, 0));
    assert_eq!(release_case(true, true, true, 101), (false, 100, 950, 0));
    assert_eq!(release_case(true, true, true, 0), (false, 100, 950, 0));
    set_syscall_stubs(previous);
}
