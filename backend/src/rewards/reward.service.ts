import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { REWARD_RULES } from './reward.rules';
import { Reward, RewardDocument } from './schemas/reward.schema';
import { TokenService } from '../solana/token.service';

@Injectable()
export class RewardService {
  constructor(
    @InjectModel(Reward.name) private rewardModel: Model<RewardDocument>,
    private tokenService: TokenService,
  ) {}

  /** Mint tokens for any of the three actions below */
  async rewardFor(
    userPubkey: string,
    action: keyof typeof REWARD_RULES,
  ): Promise<Reward> {
    const amount = REWARD_RULES[action];
    // 1) Call Token service to mint `amount` SENSOR tokens
    const txSignature = await this.tokenService.mintSensorTokens({
      to: userPubkey,
      amount,
    });
    // 2) Record in Mongo
    const reward = await this.rewardModel.create({
      userPubkey,
      action,
      amount,
      txSignature,
    });
    return reward;
  }
}
