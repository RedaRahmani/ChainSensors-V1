use arcis_imports::*;

#[encrypted]
mod circuits {
    use arcis_imports::*;

    // Input structure for the legacy add_together function
    pub struct InputValues {
        v1: u8,
        v2: u8,
    }

    // Input structure for accuracy score computation
    pub struct AccuracyInput {
        reading: f32,
        mean: f32,
        std_dev: f32,
    }

    // Legacy instruction for compatibility
    #[instruction]
    pub fn add_together(input_ctxt: Enc<Shared, InputValues>) -> Enc<Shared, u16> {
        let input = input_ctxt.to_arcis();
        let sum = input.v1 as u16 + input.v2 as u16;
        input_ctxt.owner.from_arcis(sum)
    }

    // New accuracy score computation using μ ± 2σ algorithm  
    #[instruction]
    pub fn compute_accuracy_score(input_ctxt: Enc<Shared, AccuracyInput>) -> Enc<Shared, u8> {
        let input = input_ctxt.to_arcis();
        
        // Extract encrypted values
        let reading = input.reading;
        let mean = input.mean;
        let std_dev = input.std_dev;
        
        // Compute bounds: μ - 2σ and μ + 2σ
        let two = 2.0f32;
        let two_sigma = std_dev * two;
        let lower_bound = mean - two_sigma;
        let upper_bound = mean + two_sigma;
        
        // MPC-safe approach: compute squared distances to avoid comparisons
        // If reading is within bounds, both distances should be small
        let dist_from_lower = reading - lower_bound;
        let dist_from_upper = upper_bound - reading;
        
        // Use a heuristic: if both distances are positive, we're in range
        // For MPC safety, we'll use squared values and thresholds
        let lower_check = dist_from_lower * dist_from_lower;
        let upper_check = dist_from_upper * dist_from_upper;
        
        // Simple scoring: if reading appears roughly within bounds
        // This is a simplified MPC-safe approximation
        let score_factor = 1.0f32 / (1.0f32 + lower_check + upper_check);
        
        // Convert to binary score: threshold at 0.1
        let threshold = 0.1f32;
        let accuracy_score = if score_factor > threshold { 1u8 } else { 0u8 };
        
        input_ctxt.owner.from_arcis(accuracy_score)
    }
}
