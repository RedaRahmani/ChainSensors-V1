import {
    Controller,
    Get,
    Param,
    Query,
    ParseIntPipe,
    DefaultValuePipe,
  } from '@nestjs/common';
  import { ReadingService } from './reading.service';
  
  @Controller('readings')
  export class ReadingController {
    constructor(private readonly readingService: ReadingService) {}
  
    /**
     * GET /readings/:deviceId?skip=0&limit=50
     */
    @Get(':deviceId')
    async getReadings(
      @Param('deviceId') deviceId: string,
      @Query('skip', new DefaultValuePipe('0'), ParseIntPipe) skip: number,
      @Query('limit', new DefaultValuePipe('100'), ParseIntPipe) limit: number,
    ) {
      return this.readingService.findByDevice(deviceId, skip, limit);
    }
  
    /**
     * GET /readings/:deviceId/raw/:blobId
     */
    @Get(':deviceId/raw/:blobId')
    async getRaw(
      @Param('deviceId') deviceId: string,
      @Param('blobId') blobId: string,
    ) {
      return this.readingService.getRaw(deviceId, blobId);
    }
  }
  
// backend/src/reading/reading.controller.ts
// import {
//   Controller,
//   Get,
//   Param,
//   Query,
//   ParseIntPipe,
//   DefaultValuePipe,
// } from '@nestjs/common';
// import { ReadingService } from './reading.service';

// @Controller('readings')
// export class ReadingController {
//   constructor(private readonly readingService: ReadingService) {}

//   @Get(':deviceId')
//   async getReadings(
//     @Param('deviceId') deviceId: string,
//     @Query('skip', new DefaultValuePipe('0'), ParseIntPipe) skip: number,
//     @Query('limit', new DefaultValuePipe('100'), ParseIntPipe) limit: number,
//   ) {
//     return this.readingService.findByDevice(deviceId, skip, limit);
//   }

//   @Get(':deviceId/raw/:blobId')
//   async getRaw(
//     @Param('deviceId') deviceId: string,
//     @Param('blobId') blobId: string,
//   ) {
//     return this.readingService.getRaw(deviceId, blobId);
//   }
// }