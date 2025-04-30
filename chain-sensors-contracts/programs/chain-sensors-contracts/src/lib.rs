use anchor_lang::prelude::*;

declare_id!("2br92QQ6NsTZV5Scny6nfh6JvQmUMobd7JDHSTasAgYK");

#[program]
pub mod chain_sensors_contracts {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
