// #![cfg(feature = "test-sbf")]

// use anchor_lang::{AnchorDeserialize, InstructionData, ToAccountMetas};
// use light_client::indexer::test_indexer::TestIndexer;
// use light_client::indexer::{AddressMerkleTreeAccounts, Indexer, StateMerkleTreeAccounts};
// use light_client::rpc::merkle_tree::MerkleTreeExt;
// use light_client::rpc::test_rpc::ProgramTestRpcConnection;
// use light_sdk::address::{derive_address, derive_address_seed};
// use light_sdk::compressed_account::CompressedAccountWithMerkleContext;
// use light_sdk::merkle_context::{
//     pack_address_merkle_context, pack_merkle_context, AddressMerkleContext, RemainingAccounts,
// };
// use light_sdk::utils::get_cpi_authority_pda;
// use light_sdk::{PROGRAM_ID_ACCOUNT_COMPRESSION, PROGRAM_ID_LIGHT_SYSTEM, PROGRAM_ID_NOOP};
// use light_test_utils::test_env::{setup_test_programs_with_accounts_v2, EnvAccounts};
// use light_test_utils::{RpcConnection, RpcError};
// use solana_sdk::instruction::Instruction;
// use solana_sdk::pubkey::Pubkey;
// use solana_sdk::signature::{Keypair, Signer};
// use test::{state::CounterCompressedAccount, CPI_AUTHORITY_PDA_SEED};
// use anchor_spl::token::{Mint, TokenAccount};
// use chainsensor::instruction;
// use chainsensor::accounts;
// use chainsensor::state::Marketplace;
// use chainsensor::state::DeviceRegistry;


// #[tokio::test]
// async fn test_device_registry_mocked() {
//     println!("Testing device registry (mocked)...");

//     let (mut rpc, env) = setup_test_programs_with_accounts_v2(Some(vec![(
//         String::from("test"),
//         chainsensor::ID,
//     )])).await.unwrap();
//     let payer = rpc.get_payer().insecure_clone();

//     // Setup mocked indexer
//     let mut test_indexer: TestIndexer<ProgramTestRpcConnection> = TestIndexer::new(
//         &[StateMerkleTreeAccounts {
//             merkle_tree: env.merkle_tree_pubkey,
//             nullifier_queue: env.nullifier_queue_pubkey,
//             cpi_context: env.cpi_context_account_pubkey,
//         }],
//         &[AddressMerkleTreeAccounts {
//             merkle_tree: env.address_merkle_tree_pubkey,
//             queue: env.address_merkle_tree_queue_pubkey,
//         }],
//         false,
//         false,
//     ).await;

//     // Initialize marketplace
//     let usdc_mint = rpc.create_mint(&payer, 6).await.unwrap();
//     let marketplace_key = initialize_marketplace(&mut rpc, &payer, &usdc_mint, "TestMarket", 500)
//         .await
//         .unwrap();

//     // Mock register_device
//     let device_id = "device1".to_string();
//     let mut remaining_accounts = RemainingAccounts::default();
//     let merkle_tree_index = remaining_accounts.insert_or_get(env.merkle_tree_pubkey);

//     let address_merkle_context = AddressMerkleContext {
//         address_merkle_tree_pubkey: env.address_merkle_tree_pubkey,
//         address_queue_pubkey: env.address_merkle_tree_queue_pubkey,
//     };
//     let seeds = [b"device", marketplace_key.as_ref(), device_id.as_bytes()];
//     let address_seed = derive_address_seed(&seeds, &ID, &address_merkle_context);
//     let address = derive_address(&address_seed, &address_merkle_context);
//     let packed_address_merkle_context = pack_address_merkle_context(address_merkle_context, &mut remaining_accounts);

//     // Simulate compressed account creation
//     let device_registry = DeviceRegistry {
//         owner: payer.pubkey(),
//         marketplace: marketplace_key,
//         device_id: device_id.clone(),
//         ek_pubkey_hash: [1u8; 32],
//         is_active: true,
//         price_per_unit: 10,
//         total_data_units: 100,
//         data_cid: "cid123".to_string(),
//         access_key_hash: [2u8; 32],
//         metadata: chainsensor::state::DeviceMetadata {
//             device_type: "sensor".to_string(),
//             location: "location1".to_string(),
//             data_type: "temperature".to_string(),
//             data_unit: "celsius".to_string(),
//         },
//     };

//     // Mock indexer adding the compressed account
//     test_indexer.add_compressed_account(
//         address,
//         env.merkle_tree_pubkey,
//         device_registry.try_to_vec().unwrap(),
//         ID,
//     );

//     // Verify
//     let compressed_accounts = test_indexer.get_compressed_accounts_by_owner(&ID);
//     assert_eq!(compressed_accounts.len(), 1);
//     let compressed_account = &compressed_accounts[0];
//     assert_eq!(compressed_account.compressed_account.address, Some(address));
//     let deserialized = DeviceRegistry::deserialize(
//         &mut &compressed_account.compressed_account.data.as_ref().unwrap().data[..]
//     ).unwrap();
//     assert_eq!(deserialized.owner, payer.pubkey());
//     assert_eq!(deserialized.marketplace, marketplace_key);
//     assert_eq!(deserialized.device_id, device_id);
//     assert_eq!(deserialized.price_per_unit, 10);
//     assert_eq!(deserialized.total_data_units, 100);
//     assert!(deserialized.is_active);

//     println!("Mocked device registry tests passed!");
// }

// // Include helper function from your original test.rs
// async fn initialize_marketplace<R>(
//     rpc: &mut R,
//     payer: &Keypair,
//     usdc_mint: &Mint,
//     name: &str,
//     seller_fee: u16,
// ) -> Result<Pubkey, RpcError>
// where
//     R: RpcConnection,
// {
//     let (marketplace_key, _) = Pubkey::find_program_address(&[b"marketplace", payer.pubkey().as_ref()], &ID);
//     let (treasury_key, _) = Pubkey::find_program_address(&[b"treasury", payer.pubkey().as_ref()], &ID);

//     let instruction_data = instruction::Initialize {
//         name: name.to_string(),
//         seller_fee,
//     };

//     let accounts = accounts::Initialize {
//         admin: payer.pubkey(),
//         marketplace: marketplace_key,
//         treasury: treasury_key,
//         usdc_mint: usdc_mint.pubkey(),
//         token_program: anchor_spl::token::ID,
//         system_program: solana_sdk::system_program::id(),
//         rent: solana_sdk::sysvar::rent::id(),
//     };

//     let instruction = Instruction {
//         program_id: ID,
//         accounts: accounts.to_account_metas(Some(true)),
//         data: instruction_data.data(),
//     };

//     rpc.create_and_send_transaction(&[instruction], &payer.pubkey(), &[payer])
//         .await?;
//     Ok(marketplace_key)
// }
#![cfg(feature = "test-sbf")]

use anchor_lang::AccountDeserialize;
use light_client::indexer::test_indexer::TestIndexer;
use light_client::rpc::test_rpc::ProgramTestRpcConnection;
use light_sdk::address::derive_address;
use light_test_utils::test_env::{setup_test_programs_with_accounts_v2, EnvAccounts};
use solana_sdk::instruction::Instruction;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::{Keypair, Signer};
use solana_sdk::transaction::TransactionError;
use chainsensor::state::{DeviceRegistry, DeviceMetadata, Marketplace};
use chainsensor::ID as PROGRAM_ID; use anchor_lang::prelude::ErrorCode;
use solana_sdk::instruction::InstructionError;
use anchor_lang::{ToAccountMetas, InstructionData, prelude::ErrorCode};
use light_test_utils::RpcConnection;


// Helper function to initialize the marketplace
async fn initialize_marketplace<R: light_client::rpc::RpcConnection>(
    rpc: &mut R,
    payer: &Keypair,
    name: &str,
    seller_fee: u16,
) -> Result<Pubkey, TransactionError> {
    let (marketplace_key, bump) = Pubkey::find_program_address(&[b"marketplace", payer.pubkey().as_ref()], &PROGRAM_ID);
    let (treasury_key, treasury_bump) = Pubkey::find_program_address(&[b"treasury", payer.pubkey().as_ref()], &PROGRAM_ID);
    let usdc_mint = Pubkey::new_unique(); // Mock USDC mint for testing

    let accounts = chainsensor::accounts::Initialize {
        admin: payer.pubkey(),
        marketplace: marketplace_key,
        treasury: treasury_key,
        usdc_mint,
        token_program: anchor_spl::token::ID,
        system_program: solana_sdk::system_program::id(),
        rent: solana_sdk::sysvar::rent::id(),
    };

    let instruction_data = chainsensor::instruction::Initialize {
        name: name.to_string(),
        seller_fee,
        _bumps: chainsensor::accounts::InitializeBumps { marketplace: bump, treasury: treasury_bump },
    };

    let instruction = Instruction {
        program_id: PROGRAM_ID,
        accounts: accounts.to_account_metas(Some(true)),
        data: instruction_data.data(),
    };

    match rpc.create_and_send_transaction(&[instruction], &payer.pubkey(), &[payer]).await {
        Ok(_) => Ok(marketplace_key),
        Err(e) => Err(e),
    }
}

// Helper function to register a device
async fn register_device<R: light_client::rpc::RpcConnection + light_client::rpc::merkle_tree::MerkleTreeExt>(
//async fn register_device<R: light_client::rpc::RpcConnection>(
    rpc: &mut R,
    test_indexer: &mut TestIndexer<R>,
    env: &EnvAccounts,
    payer: &Keypair,
    marketplace_key: Pubkey,
    device_id: &str,
    price_per_unit: u64,
    total_data_units: u64,
) -> Result<[u8; 32], TransactionError> {
    let address_seed = device_id.as_bytes();
    let address = derive_address(address_seed, &PROGRAM_ID);
    let proof = test_indexer.create_proof_for_compressed_accounts(&[address], None).await;

    let metadata = DeviceMetadata {
        sensor_type: "Temperature".to_string(),
        location: "Room1".to_string(),
        description: "Test sensor".to_string(),
    };

    let accounts = chainsensor::accounts::RegisterDevice {
        owner: payer.pubkey(),
        marketplace: marketplace_key,
        cpi_authority: get_cpi_authority_pda(&PROGRAM_ID).0,
        system_program: solana_sdk::system_program::id(),
        light_system_program: PROGRAM_ID_LIGHT_SYSTEM,
        account_compression_program: PROGRAM_ID_ACCOUNT_COMPRESSION,
        noop_program: PROGRAM_ID_NOOP,
        registered_program_pda: light_sdk::get_registered_program_pda(&PROGRAM_ID_LIGHT_SYSTEM),
        address_merkle_tree: env.address_merkle_tree_pubkey,
        address_queue: env.address_queue_pubkey,
        state_merkle_tree: env.state_merkle_tree_pubkey,
        state_queue: env.state_queue_pubkey,
    };

    let instruction_data = chainsensor::instruction::RegisterDevice {
        address,
        device_id: device_id.to_string(),
        price_per_unit,
        total_data_units,
        metadata,
        address_merkle_context: pack_address_merkle_context(env.address_merkle_tree_pubkey, env.address_queue_pubkey),
        proof: proof.clone(),
    };

    let instruction = Instruction {
        program_id: PROGRAM_ID,
        accounts: accounts.to_account_metas(Some(true)),
        data: instruction_data.data(),
    };

    match rpc.create_and_send_transaction_with_event(&[instruction], &payer.pubkey(), &[payer], Some(test_indexer)).await {
        Ok(_) => Ok(address),
        Err(e) => Err(e),
    }
}

// Tests for Marketplace Initialization

#[tokio::test]
async fn test_initialize_marketplace_success() {
    let (mut rpc, _) = setup_test_programs_with_accounts_v2(Some(vec![(
        String::from("chainsensor"),
        PROGRAM_ID,
    )])).await;
    let payer = rpc.get_payer().insecure_clone();

    let marketplace_key = initialize_marketplace(&mut rpc, &payer, "TestMarket", 500).await.unwrap();

    let marketplace_data = rpc.get_account_data(&marketplace_key).await.unwrap();
    let marketplace: Marketplace = AccountDeserialize::try_deserialize(&mut &marketplace_data[..]).unwrap();

    assert_eq!(marketplace.admin, payer.pubkey());
    assert_eq!(marketplace.name, "TestMarket");
    assert_eq!(marketplace.seller_fee, 500);
    assert!(marketplace.is_active);
}

#[tokio::test]
async fn test_initialize_marketplace_name_too_long() {
    let (mut rpc, _) = setup_test_programs_with_accounts_v2(Some(vec![(
        String::from("chainsensor"),
        PROGRAM_ID,
    )])).await;
    let payer = rpc.get_payer().insecure_clone();

    let name = "a".repeat(33); // Exceeds 32 characters
    let result = initialize_marketplace(&mut rpc, &payer, &name, 500).await;

    assert!(result.is_err());
    if let TransactionError::InstructionError(_, InstructionError::Custom(code)) = result.err().unwrap() {
        assert_eq!(code, ErrorCode::NameTooLong as u32); // Error code 0
    } else {
        panic!("Expected NameTooLong error");
    }
}

#[tokio::test]
async fn test_initialize_marketplace_name_empty() {
    let (mut rpc, _) = setup_test_programs_with_accounts_v2(Some(vec![(
        String::from("chainsensor"),
        PROGRAM_ID,
    )])).await;
    let payer = rpc.get_payer().insecure_clone();

    let result = initialize_marketplace(&mut rpc, &payer, "", 500).await;

    assert!(result.is_err());
    if let TransactionError::InstructionError(_, InstructionError::Custom(code)) = result.err().unwrap() {
        assert_eq!(code, ErrorCode::NameEmpty as u32); // Error code 2
    } else {
        panic!("Expected NameEmpty error");
    }
}

#[tokio::test]
async fn test_initialize_marketplace_invalid_name_chars() {
    let (mut rpc, _) = setup_test_programs_with_accounts_v2(Some(vec![(
        String::from("chainsensor"),
        PROGRAM_ID,
    )])).await;
    let payer = rpc.get_payer().insecure_clone();

    let result = initialize_marketplace(&mut rpc, &payer, "Invalid@Name", 500).await;

    assert!(result.is_err());
    if let TransactionError::InstructionError(_, InstructionError::Custom(code)) = result.err().unwrap() {
        assert_eq!(code, ErrorCode::InvalidNameChars as u32); // Error code 3
    } else {
        panic!("Expected InvalidNameChars error");
    }
}

#[tokio::test]
async fn test_initialize_marketplace_invalid_fee() {
    let (mut rpc, _) = setup_test_programs_with_accounts_v2(Some(vec![(
        String::from("chainsensor"),
        PROGRAM_ID,
    )])).await;
    let payer = rpc.get_payer().insecure_clone();

    let result = initialize_marketplace(&mut rpc, &payer, "TestMarket", 10001).await; // Fee > 10000 basis points

    assert!(result.is_err());
    if let TransactionError::InstructionError(_, InstructionError::Custom(code)) = result.err().unwrap() {
        assert_eq!(code, ErrorCode::InvalidFee as u32); // Error code 1
    } else {
        panic!("Expected InvalidFee error");
    }
}

// Tests for Device Registration

#[tokio::test]
async fn test_register_device_success() {
    let (mut rpc, env) = setup_test_programs_with_accounts_v2(Some(vec![(
        String::from("chainsensor"),
        PROGRAM_ID,
    )])).await;
    let payer = rpc.get_payer().insecure_clone();
    let mut test_indexer = TestIndexer::new(
        env.state_merkle_tree_pubkey,
        env.state_queue_pubkey,
        env.address_merkle_tree_pubkey,
        env.address_queue_pubkey,
        None,
        rpc.clone(),
    )
    .await;

    let marketplace_key = initialize_marketplace(&mut rpc, &payer, "TestMarket", 500).await.unwrap();

    let device_id = "device1";
    let address = register_device(
        &mut rpc,
        &mut test_indexer,
        &env,
        &payer,
        marketplace_key,
        device_id,
        100, // price_per_unit
        1000, // total_data_units
    ).await.unwrap();

    let compressed_accounts = test_indexer.get_compressed_accounts_by_owner(&PROGRAM_ID);
    assert_eq!(compressed_accounts.len(), 1);

    let compressed_account = &compressed_accounts[0];
    assert_eq!(compressed_account.compressed_account.address, Some(address));

    let device_data = &compressed_account.compressed_account.data.as_ref().unwrap().data;
    let device: DeviceRegistry = DeviceRegistry::deserialize(&mut &device_data[..]).unwrap();

    assert_eq!(device.owner, payer.pubkey());
    assert_eq!(device.marketplace, marketplace_key);
    assert_eq!(device.device_id, device_id);
    assert_eq!(device.price_per_unit, 100);
    assert_eq!(device.total_data_units, 1000);
    assert!(device.is_active);
    assert_eq!(device.metadata.sensor_type, "Temperature");
    assert_eq!(device.metadata.location, "Room1");
    assert_eq!(device.metadata.description, "Test sensor");
}

#[tokio::test]
async fn test_register_device_empty_device_id() {
    let (mut rpc, env) = setup_test_programs_with_accounts_v2(Some(vec![(
        String::from("chainsensor"),
        PROGRAM_ID,
    )])).await;
    let payer = rpc.get_payer().insecure_clone();
    let mut test_indexer = TestIndexer::new(
        env.state_merkle_tree_pubkey,
        env.state_queue_pubkey,
        env.address_merkle_tree_pubkey,
        env.address_queue_pubkey,
        None,
        rpc.clone(),
    )
    .await;

    let marketplace_key = initialize_marketplace(&mut rpc, &payer, "TestMarket", 500).await.unwrap();

    let result = register_device(
        &mut rpc,
        &mut test_indexer,
        &env,
        &payer,
        marketplace_key,
        "", // Empty device ID
        100,
        1000,
    ).await;

    assert!(result.is_err());
    if let TransactionError::InstructionError(_, InstructionError::Custom(code)) = result.err().unwrap() {
        assert_eq!(code, ErrorCode::DeviceIdEmpty as u32); // Error code 1
    } else {
        panic!("Expected DeviceIdEmpty error");
    }
}

#[tokio::test]
async fn test_register_device_invalid_price() {
    let (mut rpc, env) = setup_test_programs_with_accounts_v2(Some(vec![(
        String::from("chainsensor"),
        PROGRAM_ID,
    )])).await;
    let payer = rpc.get_payer().insecure_clone();
    let mut test_indexer = TestIndexer::new(
        env.state_merkle_tree_pubkey,
        env.state_queue_pubkey,
        env.address_merkle_tree_pubkey,
        env.address_queue_pubkey,
        None,
        rpc.clone(),
    )
    .await;

    let marketplace_key = initialize_marketplace(&mut rpc, &payer, "TestMarket", 500).await.unwrap();

    let result = register_device(
        &mut rpc,
        &mut test_indexer,
        &env,
        &payer,
        marketplace_key,
        "device1",
        0, // Invalid price
        1000,
    ).await;

    assert!(result.is_err());
    if let TransactionError::InstructionError(_, InstructionError::Custom(code)) = result.err().unwrap() {
        assert_eq!(code, ErrorCode::InvalidPrice as u32); // Error code 7
    } else {
        panic!("Expected InvalidPrice error");
    }
}

#[tokio::test]
async fn test_register_device_invalid_total_data_units() {
    let (mut rpc, env) = setup_test_programs_with_accounts_v2(Some(vec![(
        String::from("chainsensor"),
        PROGRAM_ID,
    )])).await;
    let payer = rpc.get_payer().insecure_clone();
    let mut test_indexer = TestIndexer::new(
        env.state_merkle_tree_pubkey,
        env.state_queue_pubkey,
        env.address_merkle_tree_pubkey,
        env.address_queue_pubkey,
        None,
        rpc.clone(),
    )
    .await;

    let marketplace_key = initialize_marketplace(&mut rpc, &payer, "TestMarket", 500).await.unwrap();

    let result = register_device(
        &mut rpc,
        &mut test_indexer,
        &env,
        &payer,
        marketplace_key,
        "device1",
        100,
        0, // Invalid total_data_units
    ).await;

    assert!(result.is_err());
    if let TransactionError::InstructionError(_, InstructionError::Custom(code)) = result.err().unwrap() {
        assert_eq!(code, ErrorCode::InvalidTotalDataUnits as u32); // Assuming error code 8, adjust if different
    } else {
        panic!("Expected InvalidTotalDataUnits error");
    }
}

// #[tokio::test]
// async fn test() {
//     // Start prover with light start-prover --run-mode rpc
//     let (mut rpc, env) = setup_test_programs_with_accounts_v2(Some(vec![(
//         String::from("test"),
//         chainsensor::ID,
//     )]))
//     .await;
//     let payer = rpc.get_payer().insecure_clone();

//     let mut test_indexer: TestIndexer<ProgramTestRpcConnection> = TestIndexer::new(
//         &[StateMerkleTreeAccounts {
//             merkle_tree: env.merkle_tree_pubkey,
//             nullifier_queue: env.nullifier_queue_pubkey,
//             cpi_context: env.cpi_context_account_pubkey,
//         }],
//         &[AddressMerkleTreeAccounts {
//             merkle_tree: env.address_merkle_tree_pubkey,
//             queue: env.address_merkle_tree_queue_pubkey,
//         }],
//         false,
//         false,
//     )
//     .await;

//     let address = create_account(&mut rpc, &mut test_indexer, &env, &payer)
//         .await
//         .unwrap();

//     // Check that it was created correctly.
//     let compressed_accounts =
//         test_indexer.get_compressed_accounts_by_owner(&chainsensor::ID);
//     assert_eq!(compressed_accounts.len(), 1);
//     let compressed_account = &compressed_accounts[0];
//     assert_eq!(compressed_account.compressed_account.address, Some(address));

//     let counter_account = &compressed_account
//         .compressed_account
//         .data
//         .as_ref()
//         .unwrap()
//         .data;
//     let counter_account = CounterCompressedAccount::deserialize(&mut &counter_account[..]).unwrap();
//     assert_eq!(counter_account.owner, payer.pubkey());
//     assert_eq!(counter_account.counter, 0);

//     increment(
//         &mut rpc,
//         &mut test_indexer,
//         &payer,
//         compressed_account,
//         env.merkle_tree_pubkey,
//         address,
//         counter_account.counter,
//     )
//     .await
//     .unwrap();

//     // Check that it was updated correctly.
//     let compressed_accounts =
//         test_indexer.get_compressed_accounts_by_owner(&chainsensor::ID);
//     assert_eq!(compressed_accounts.len(), 1);
//     let compressed_account = &compressed_accounts[0];
//     let counter_account = &compressed_account
//         .compressed_account
//         .data
//         .as_ref()
//         .unwrap()
//         .data;
//     let counter_account = CounterCompressedAccount::deserialize(&mut &counter_account[..]).unwrap();
//     assert_eq!(counter_account.owner, payer.pubkey());
//     assert_eq!(counter_account.counter, 1);

//     delete_account(
//         &mut rpc,
//         &mut test_indexer,
//         &payer,
//         compressed_account,
//         address,
//         counter_account.counter,
//     )
//     .await
//     .unwrap();
//     let compressed_accounts =
//         test_indexer.get_compressed_accounts_by_owner(&chainsensor::ID);
//     assert_eq!(compressed_accounts.len(), 0);
// }

// async fn create_account<R>(
//     rpc: &mut R,
//     test_indexer: &mut TestIndexer<R>,
//     env: &EnvAccounts,
//     payer: &Keypair,
// ) -> Result<[u8; 32], RpcError>
// where
//     R: RpcConnection + MerkleTreeExt,
// {
//     let mut remaining_accounts = RemainingAccounts::default();

//     let merkle_tree_index = remaining_accounts.insert_or_get(env.merkle_tree_pubkey);

//     let address_merkle_context = AddressMerkleContext {
//         address_merkle_tree_pubkey: env.address_merkle_tree_pubkey,
//         address_queue_pubkey: env.address_merkle_tree_queue_pubkey,
//     };

//     let address_seed = derive_address_seed(
//         &[b"counter", payer.pubkey().as_ref()],
//         &chainsensor::ID,
//         &address_merkle_context,
//     );
//     let address = derive_address(&address_seed, &address_merkle_context);

//     let address_merkle_context =
//         pack_address_merkle_context(address_merkle_context, &mut remaining_accounts);

//     let account_compression_authority = get_cpi_authority_pda(&PROGRAM_ID_LIGHT_SYSTEM);
//     let registered_program_pda = Pubkey::find_program_address(
//         &[PROGRAM_ID_LIGHT_SYSTEM.to_bytes().as_slice()],
//         &PROGRAM_ID_ACCOUNT_COMPRESSION,
//     )
//     .0;
//     let rpc_result = test_indexer
//         .create_proof_for_compressed_accounts(
//             None,
//             None,
//             Some(&[address]),
//             Some(vec![env.address_merkle_tree_pubkey]),
//             rpc,
//         )
//         .await;
//     let (cpi_signer, bump) = Pubkey::find_program_address(
//         [CPI_AUTHORITY_PDA_SEED].as_slice(),
//         &chainsensor::ID,
//     );

//     let instruction_data = test::instruction::Create {
//         proof: rpc_result.proof,
//         address_merkle_context,
//         address_merkle_tree_root_index: rpc_result.address_root_indices[0],
//         bump,
//         merkle_tree_index,
//     };

//     let accounts = test::accounts::GenericAccounts {
//         signer: payer.pubkey(),
//         light_system_program: PROGRAM_ID_LIGHT_SYSTEM,
//         account_compression_program: PROGRAM_ID_ACCOUNT_COMPRESSION,
//         account_compression_authority,
//         registered_program_pda,
//         noop_program: PROGRAM_ID_NOOP,
//         self_program: chainsensor::ID,
//         cpi_signer,
//         system_program: solana_sdk::system_program::id(),
//     };

//     let remaining_accounts = remaining_accounts.to_account_metas();

//     let instruction = Instruction {
//         program_id: chainsensor::ID,
//         accounts: [accounts.to_account_metas(Some(true)), remaining_accounts].concat(),
//         data: instruction_data.data(),
//     };

//     let event = rpc
//         .create_and_send_transaction_with_event(&[instruction], &payer.pubkey(), &[payer], None)
//         .await?;
//     test_indexer.add_compressed_accounts_with_token_data(&event.unwrap().0);
//     Ok(address)
// }

// async fn test_marketplace_and_device_registry<R>(
//     rpc: &mut R,
//     test_indexer: &mut TestIndexer<R>,
//     env: &EnvAccounts,
//     payer: &Keypair,
// ) where
//     R: RpcConnection + MerkleTreeExt,
// {
//     println!("Testing marketplace and device registry...");

//     // Create a USDC mint for the marketplace
//     let usdc_mint = rpc.create_mint(&payer, 6).await.unwrap();

//     // Initialize marketplace
//     let marketplace_key = initialize_marketplace(rpc, payer, &usdc_mint, "TestMarket", 500).await.unwrap();
//     let marketplace_account: Marketplace = rpc.get_account(marketplace_key).await.unwrap();
//     assert_eq!(marketplace_account.admin, payer.pubkey());
//     assert_eq!(marketplace_account.name, "TestMarket");
//     assert_eq!(marketplace_account.seller_fee, 500);
//     assert!(marketplace_account.is_active);

//     // Verify treasury token account
//     let treasury_key = Pubkey::find_program_address(
//         &[b"treasury", payer.pubkey().as_ref()],
//         &chainsensor::ID,
//     ).0;
//     let treasury_account: TokenAccount = rpc.get_account(treasury_key).await.unwrap();
//     assert_eq!(treasury_account.mint, usdc_mint.pubkey());
//     assert_eq!(treasury_account.owner, payer.pubkey());

//     // Register a device
//     let device_id = "device1".to_string();
//     let address = register_device(
//         rpc,
//         test_indexer,
//         env,
//         payer,
//         &marketplace_key,
//         device_id.clone(),
//         [1u8; 32], // ek_pubkey_hash
//         "sensor".to_string(),
//         "location1".to_string(),
//         "temperature".to_string(),
//         "celsius".to_string(),
//         10,
//         100,
//         "cid123".to_string(),
//         [2u8; 32], // access_key_hash
//     ).await.unwrap();

//     // Verify device registration
//     let compressed_accounts = test_indexer.get_compressed_accounts_by_owner(&chainsensor::ID);
//     assert_eq!(compressed_accounts.len(), 1);
//     let compressed_account = &compressed_accounts[0];
//     assert_eq!(compressed_account.compressed_account.address, Some(address));
//     let device_registry = DeviceRegistry::deserialize(
//         &mut &compressed_account.compressed_account.data.as_ref().unwrap().data[..]
//     ).unwrap();
//     assert_eq!(device_registry.owner, payer.pubkey());
//     assert_eq!(device_registry.marketplace, marketplace_key);
//     assert_eq!(device_registry.device_id, device_id);
//     assert_eq!(device_registry.price_per_unit, 10);
//     assert_eq!(device_registry.total_data_units, 100);
//     assert!(device_registry.is_active);

//     // Test error case: empty device ID
//     let result = register_device(
//         rpc,
//         test_indexer,
//         env,
//         payer,
//         &marketplace_key,
//         "".to_string(),
//         [1u8; 32],
//         "sensor".to_string(),
//         "location1".to_string(),
//         "temperature".to_string(),
//         "celsius".to_string(),
//         10,
//         100,
//         "cid123".to_string(),
//         [2u8; 32],
//     ).await;
//     assert!(result.is_err(), "Empty device ID should fail");

//     println!("Marketplace and device registry tests passed!");
// }

// async fn initialize_marketplace<R>(
//     rpc: &mut R,
//     payer: &Keypair,
//     usdc_mint: &Mint,
//     name: &str,
//     seller_fee: u16,
// ) -> Result<Pubkey, RpcError>
// where
//     R: RpcConnection,
// {
//     let (marketplace_key, _) = Pubkey::find_program_address(&[b"marketplace", payer.pubkey().as_ref()], &chainsensor::ID);
//     let (treasury_key, _) = Pubkey::find_program_address(&[b"treasury", payer.pubkey().as_ref()], &chainsensor::ID);

//     let instruction_data = test::instruction::Initialize {
//         name: name.to_string(),
//         seller_fee,
//     };

//     let accounts = test::accounts::Initialize {
//         admin: payer.pubkey(),
//         marketplace: marketplace_key,
//         treasury: treasury_key,
//         usdc_mint: usdc_mint.pubkey(),
//         token_program: anchor_spl::token::ID,
//         system_program: solana_sdk::system_program::id(),
//         rent: solana_sdk::sysvar::rent::id(),
//     };

//     let instruction = Instruction {
//         program_id: chainsensor::ID,
//         accounts: accounts.to_account_metas(Some(true)),
//         data: instruction_data.data(),
//     };

//     rpc.create_and_send_transaction(&[instruction], &payer.pubkey(), &[payer])
//         .await?;
//     Ok(marketplace_key)
// }

// async fn register_device<R>(
//     rpc: &mut R,
//     test_indexer: &mut TestIndexer<R>,
//     env: &EnvAccounts,
//     payer: &Keypair,
//     marketplace_key: &Pubkey,
//     device_id: String,
//     ek_pubkey_hash: [u8; 32],
//     device_type: String,
//     location: String,
//     data_type: String,
//     data_unit: String,
//     price_per_unit: u64,
//     total_data_units: u64,
//     data_cid: String,
//     access_key_hash: [u8; 32],
// ) -> Result<[u8; 32], RpcError>
// where
//     R: RpcConnection + MerkleTreeExt,
// {
//     let mut remaining_accounts = RemainingAccounts::default();
//     let merkle_tree_index = remaining_accounts.insert_or_get(env.merkle_tree_pubkey);

//     let address_merkle_context = AddressMerkleContext {
//         address_merkle_tree_pubkey: env.address_merkle_tree_pubkey,
//         address_queue_pubkey: env.address_merkle_tree_queue_pubkey,
//     };
//     let seeds = [b"device", marketplace_key.as_ref(), device_id.as_bytes()];
//     let address_seed = derive_address_seed(seeds.as_slice(), &chainsensor::ID, &address_merkle_context);
//     let address = derive_address(&address_seed, &address_merkle_context);
//     let packed_address_merkle_context = pack_address_merkle_context(address_merkle_context, &mut remaining_accounts);

//     let rpc_result = test_indexer
//         .create_proof_for_compressed_accounts(
//             None,
//             None,
//             Some(&[address]),
//             Some(vec![env.address_merkle_tree_pubkey]),
//             rpc,
//         )
//         .await;

//     let (cpi_signer, bump) = Pubkey::find_program_address(&[CPI_AUTHORITY_PDA_SEED], &chainsensor::ID);
//     let instruction_data = test::instruction::RegisterDevice {
//         device_id,
//         ek_pubkey_hash,
//         device_type,
//         location,
//         data_type,
//         data_unit,
//         price_per_unit,
//         total_data_units,
//         data_cid,
//         access_key_hash,
//         proof: rpc_result.proof,
//         address_merkle_tree_root_index: rpc_result.address_root_indices[0],
//         address_merkle_context: packed_address_merkle_context,
//         merkle_tree_index,
//         bump,
//     };

//     let accounts = test::accounts::RegisterDevice {
//         owner: payer.pubkey(),
//         marketplace: *marketplace_key,
//         cpi_signer,
//         self_program: chainsensor::ID,
//         light_system_program: PROGRAM_ID_LIGHT_SYSTEM,
//         account_compression_program: PROGRAM_ID_ACCOUNT_COMPRESSION,
//         account_compression_authority: get_cpi_authority_pda(&PROGRAM_ID_LIGHT_SYSTEM),
//         registered_program_pda: Pubkey::find_program_address(
//             &[PROGRAM_ID_LIGHT_SYSTEM.to_bytes().as_slice()],
//             &PROGRAM_ID_ACCOUNT_COMPRESSION,
//         ).0,
//         noop_program: PROGRAM_ID_NOOP,
//         system_program: solana_sdk::system_program::id(),
//     };

//     let remaining_accounts_metas = remaining_accounts.to_account_metas();
//     let instruction = Instruction {
//         program_id: chainsensor::ID,
//         accounts: [accounts.to_account_metas(Some(true)), remaining_accounts_metas].concat(),
//         data: instruction_data.data(),
//     };

//     let event = rpc
//         .create_and_send_transaction_with_event(&[instruction], &payer.pubkey(), &[payer], None)
//         .await?;
//     test_indexer.add_compressed_accounts_with_token_data(&event.unwrap().0);
//     Ok(address)
// }

// async fn increment<R>(
//     rpc: &mut R,
//     test_indexer: &mut TestIndexer<R>,
//     payer: &Keypair,
//     compressed_account: &CompressedAccountWithMerkleContext,
//     output_merkle_tree: Pubkey,
//     address: [u8; 32],
//     input_counter_value: u64,
// ) -> Result<(), RpcError>
// where
//     R: RpcConnection + MerkleTreeExt,
// {
//     let mut remaining_accounts = RemainingAccounts::default();

//     let output_merkle_tree_index = remaining_accounts.insert_or_get(output_merkle_tree);
//     let merkle_context =
//         pack_merkle_context(compressed_account.merkle_context, &mut remaining_accounts);

//     let hash = compressed_account.hash().unwrap();
//     let merkle_tree_pubkey = compressed_account.merkle_context.merkle_tree_pubkey;

//     let rpc_result = test_indexer
//         .create_proof_for_compressed_accounts(
//             Some(&[hash]),
//             Some(&[merkle_tree_pubkey]),
//             None,
//             None,
//             rpc,
//         )
//         .await;

//     let (cpi_signer, bump) = Pubkey::find_program_address(
//         [CPI_AUTHORITY_PDA_SEED].as_slice(),
//         &chainsensor::ID,
//     );
//     let instruction_data = test::instruction::Increment {
//         proof: rpc_result.proof,
//         root_index: rpc_result.root_indices[0],
//         input_merkle_context: merkle_context,
//         output_merkle_tree_index,
//         address,
//         input_counter_value,
//         bump,
//     };

//     let account_compression_authority = get_cpi_authority_pda(&PROGRAM_ID_LIGHT_SYSTEM);
//     let registered_program_pda = Pubkey::find_program_address(
//         &[PROGRAM_ID_LIGHT_SYSTEM.to_bytes().as_slice()],
//         &PROGRAM_ID_ACCOUNT_COMPRESSION,
//     )
//     .0;
//     let accounts = test::accounts::GenericAccounts {
//         signer: payer.pubkey(),
//         light_system_program: PROGRAM_ID_LIGHT_SYSTEM,
//         account_compression_program: PROGRAM_ID_ACCOUNT_COMPRESSION,
//         account_compression_authority,
//         registered_program_pda,
//         noop_program: PROGRAM_ID_NOOP,
//         self_program: chainsensor::ID,
//         cpi_signer,
//         system_program: solana_sdk::system_program::id(),
//     };

//     let remaining_accounts = remaining_accounts.to_account_metas();

//     let instruction = Instruction {
//         program_id: chainsensor::ID,
//         accounts: [accounts.to_account_metas(Some(true)), remaining_accounts].concat(),
//         data: instruction_data.data(),
//     };

//     let event = rpc
//         .create_and_send_transaction_with_event(&[instruction], &payer.pubkey(), &[payer], None)
//         .await?;
//     test_indexer.add_compressed_accounts_with_token_data(&event.unwrap().0);
//     Ok(())
// }

// async fn delete_account<R>(
//     rpc: &mut R,
//     test_indexer: &mut TestIndexer<R>,
//     payer: &Keypair,
//     compressed_account: &CompressedAccountWithMerkleContext,
//     address: [u8; 32],
//     input_counter_value: u64,
// ) -> Result<(), RpcError>
// where
//     R: RpcConnection + MerkleTreeExt,
// {
//     let mut remaining_accounts = RemainingAccounts::default();

//     let merkle_context =
//         pack_merkle_context(compressed_account.merkle_context, &mut remaining_accounts);

//     let hash = compressed_account.hash().unwrap();
//     let merkle_tree_pubkey = compressed_account.merkle_context.merkle_tree_pubkey;

//     let rpc_result = test_indexer
//         .create_proof_for_compressed_accounts(
//             Some(&[hash]),
//             Some(&[merkle_tree_pubkey]),
//             None,
//             None,
//             rpc,
//         )
//         .await;

//     let (cpi_signer, bump) = Pubkey::find_program_address(
//         [CPI_AUTHORITY_PDA_SEED].as_slice(),
//         &chainsensor::ID,
//     );
//     let instruction_data = test::instruction::Delete {
//         proof: rpc_result.proof,
//         root_index: rpc_result.root_indices[0],
//         input_merkle_context: merkle_context,
//         address,
//         input_counter_value,
//         bump,
//     };

//     let account_compression_authority = get_cpi_authority_pda(&PROGRAM_ID_LIGHT_SYSTEM);
//     let registered_program_pda = Pubkey::find_program_address(
//         &[PROGRAM_ID_LIGHT_SYSTEM.to_bytes().as_slice()],
//         &PROGRAM_ID_ACCOUNT_COMPRESSION,
//     )
//     .0;
//     let accounts = test::accounts::GenericAccounts {
//         signer: payer.pubkey(),
//         light_system_program: PROGRAM_ID_LIGHT_SYSTEM,
//         account_compression_program: PROGRAM_ID_ACCOUNT_COMPRESSION,
//         account_compression_authority,
//         registered_program_pda,
//         noop_program: PROGRAM_ID_NOOP,
//         self_program: chainsensor::ID,
//         cpi_signer,
//         system_program: solana_sdk::system_program::id(),
//     };

//     let remaining_accounts = remaining_accounts.to_account_metas();

//     let instruction = Instruction {
//         program_id: chainsensor::ID,
//         accounts: [accounts.to_account_metas(Some(true)), remaining_accounts].concat(),
//         data: instruction_data.data(),
//     };

//     let event = rpc
//         .create_and_send_transaction_with_event(&[instruction], &payer.pubkey(), &[payer], None)
//         .await?;
//     test_indexer.add_compressed_accounts_with_token_data(&event.unwrap().0);
//     Ok(())
// }
