import { Controller, Post, Body } from '@nestjs/common';
import { RewardService } from './reward.service';

@Controller('rewards')
export class RewardController {
  constructor(private rewards: RewardService) {}

  @Post('device-registered')
  async onDeviceRegistered(@Body('walletAddress') user: string) {
    return this.rewards.rewardFor(user, 'deviceRegistration');
  }

  @Post('five-star-review')
  async onFiveStarReview(@Body('userPubkey') user: string) {
    return this.rewards.rewardFor(user, 'fiveStarReview');
  }

  @Post('continuous-data')
  async onContinuousData(@Body('userPubkey') user: string) {
    return this.rewards.rewardFor(user, 'continuousData100');
  }
}
