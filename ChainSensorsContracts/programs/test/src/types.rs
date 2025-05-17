use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub struct AnchorCompressedProof {
    pub a: [u8; 32],
    pub b0: [u8; 32],
    pub b1: [u8; 32],
    pub c: [u8; 32],
}