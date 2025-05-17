# ChainSensors

![ChainSensors Logo](https://i.ibb.co/9kzGWtZZ/Chain-Sensors-Logo.png)


## Overview

**ChainSensors** is a decentralized IoT data marketplace on Solana, empowering small sensor owners to monetize air quality, temperature, and logistics data securely. We connect sellers with buyers like smart cities, healthcare providers, and logistics firms, driving innovation and efficiency. Built on Solana’s high-speed infrastructure (65,000 TPS, sub-$0.01 fees), ChainSensors addresses the 80% of unused IoT data (GoodData) with advanced technologies.

## Technical Architecture

ChainSensors uses the **Triangle Architecture** for seamless integration:

- **Frontend (NextJS)**: A responsive UI for device registration, data uploads, and listings, with real-time visualization (e.g., air quality trends).
- **Backend (NestJS)**: Manages API requests, data validation,Zero touch Registration DPS and blockchain integration, ensuring secure user authentication.
- **Blockchain (Anchor Framework)**: Deploys smart contracts on Solana.

## Features

### zk-Compression in Sensor Token and Device Registry
We integrate zk-compression to optimize the SENSOR token and device registry accounts. IoT data (e.g., PM2.5 readings) is compressed into zero-knowledge proofs, stored in a Merkle tree, reducing account size and cutting transaction fees by 90%+. Proofs are validated on-chain via Anchor smart contracts.

### Walrus Decentralized Storage
ChainSensors uses Walrus for off-chain data storage at $0.01/GB (vs. AWS’s $0.023/GB). This ensures scalable, secure storage of large datasets like air quality logs, with cryptographic guarantees for data integrity.

### DPS Zero-Touch Registration
We implement Device Provisioning Service (DPS) for zero-touch device onboarding. Sensors like PurpleAir PA-II are automatically authenticated and provisioned, simplifying the process for owners.

### TLS Communication
All device communications are secured with TLS encryption, protecting data like temperature or logistics metrics during transmission, addressing the 98% unencrypted IoT traffic issue.

## Roadmap

- **Integrate zk-Compression in Listings**: Compress data listings on-chain, enabling high-volume transactions at lower costs.
- **Mint Compressed NFTs for Devices**: Create a compressed NFT for each device, serving as a digital certificate of ownership.
- **Quadratic Voting for Governance**: Enable SENSOR token holders to vote on platform updates using quadratic voting.
- **Expand IoT Sensor Integration**: Support more sensors (e.g., smart home, industrial) to offer diverse data types like energy usage.

## About Us

ChainSensors was built by Mohamed Reda Rahmani (AI/ML & Solana Blockchain Engineer) and Oussama Khadira (Full-Stack & Solana Blockchain Engineer). We’re committed to revolutionizing the IoT data ecosystem with decentralized power.