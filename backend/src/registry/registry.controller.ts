import {
  Controller,
  Get,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { RegistryService } from './registry.service';

@Controller('devices')
export class RegistryController {
  constructor(private readonly registryService: RegistryService) {}

  @Get()
  async getAllDevices() {
    return this.registryService.getAllDevices();
  }

  @Get(':id')
  async getDevice(@Param('id') id: string) {
    try {
      return await this.registryService.getDevice(id);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }
}
