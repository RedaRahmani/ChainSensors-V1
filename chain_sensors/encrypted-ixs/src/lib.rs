use arcis_imports::*;

#[encrypted]
mod circuits {
    use arcis_imports::*;

    // --- legacy example kept ---
    pub struct InputValues { v1: u8, v2: u8 }

    #[instruction]
    pub fn add_together(input_ctxt: Enc<Shared, InputValues>) -> Enc<Shared, u16> {
        let input = input_ctxt.to_arcis();
        let sum = input.v1 as u16 + input.v2 as u16;
        input_ctxt.owner.from_arcis(sum)
    }

    // Accuracy score (Q16.16 fixed-point, 0..100 u8), shift-free per Arcis ops.  :contentReference[oaicite:1]{index=1}
    #[instruction]
    pub fn compute_accuracy_score(
        reading_q16_16: Enc<Shared, u32>,
        mean_q16_16: Enc<Shared, u32>,
        std_q16_16: Enc<Shared, u32>,
    ) -> Enc<Shared, u8> {
        // bring encrypted values into Arcis as signed i64 for math headroom
        let r = reading_q16_16.to_arcis() as i64;
        let m = mean_q16_16.to_arcis() as i64;
        let s = std_q16_16.to_arcis() as i64;

        // Q16.16 constants (no shifts)
        const ONE_Q_I64: i64 = 65_536;        // 1.0 in Q16.16
        const ONE_Q_I128: i128 = 65_536;

        // bounds: μ ± 2σ  (still Q16.16)
        let two_sigma = s * 2;
        let lower = m - two_sigma;
        let upper = m + two_sigma;

        // distances in Q16.16 (signed)
        let d_lower = r - lower;
        let d_upper = upper - r;

        // square(x) in Q16.16: (x*x)/ONE_Q; do mult in i128, then scale down
        let sq = |x: i64| -> i64 {
            let xx = (x as i128) * (x as i128);
            (xx / ONE_Q_I128) as i64
        };

        let lower_check = sq(d_lower);
        let upper_check = sq(d_upper);

        // denom = 1.0_Q + lower_check + upper_check (Q16.16)
        let mut denom = ONE_Q_I64 + lower_check + upper_check;
        if denom <= 0 { denom = 1; } // defensive

        // score_q16 = (1.0_Q / denom) in Q16.16 => (ONE_Q*ONE_Q)/denom
        let score_q16 = (((ONE_Q_I128 * ONE_Q_I128) / (denom as i128)) as i64);

        // scale to 0..100 (integer), truncate and clamp (no .round())
        let mut score_u8_i = (score_q16 * 100) / ONE_Q_I64;
        if score_u8_i < 0 { score_u8_i = 0; }
        if score_u8_i > 100 { score_u8_i = 100; }

        reading_q16_16.owner.from_arcis(score_u8_i as u8)
    }

    // Reseal 32-byte DEK (as four u64) from MXE to buyer Shared — passthrough
    #[instruction]
    pub fn reseal_dek(mxe_dek: Enc<Mxe, [u64; 4]>, buyer: Shared) -> Enc<Shared, [u64; 4]> {
        let chunks = mxe_dek.to_arcis();
        buyer.from_arcis(chunks)
    }
}
