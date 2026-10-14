import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { GenerateQrCodeDto } from './dto/generate-qrcode.dto';
import { SubmitBeneficiaryDto } from './dto/submit-beneficiary.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { QrcodeService } from './qrcode.service';

@ApiTags('qrcode')
@Controller('qrcode')
export class QrcodeController {
  constructor(private readonly qrcodeService: QrcodeService) {}

  @Post('generate')
  @UseGuards(JwtAuthGuard)
  generate(
    @Body() generateQrCodeDto: GenerateQrCodeDto,
    @Req() req: Request,
  ) {
    return this.qrcodeService.generate(
      generateQrCodeDto,
      this.requestOrigin(req),
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.qrcodeService.findAll();
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  findTransactions(
    @Query('reference') reference?: string,
    @Query('name') name?: string,
  ) {
    return this.qrcodeService.searchTransactions(reference, name);
  }

  @Get('banks')
  listBanks(@Query('searchTerm') searchTerm?: string) {
    return this.qrcodeService.listBanks(searchTerm);
  }

  @Get(':id/image')
  @Header('Cache-Control', 'no-store')
  async image(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StreamableFile> {
    const image = await this.qrcodeService.renderQrImage(id);

    return new StreamableFile(image, {
      type: 'image/png',
      disposition: `inline; filename="qrcode-${id}.png"`,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.qrcodeService.findOne(id, this.requestOrigin(req));
  }

  @Post(':id/details')
  @HttpCode(HttpStatus.OK)
  submitDetails(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() submitBeneficiaryDto: SubmitBeneficiaryDto,
  ) {
    return this.qrcodeService.submitDetails(id, submitBeneficiaryDto);
  }

  @Patch(':id/payment')
  @UseGuards(JwtAuthGuard)
  updatePaymentStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePaymentStatusDto: UpdatePaymentStatusDto,
  ) {
    return this.qrcodeService.updatePaymentStatus(id, updatePaymentStatusDto);
  }

  private requestOrigin(req: Request): string {
    return `${req.protocol}://${req.get('host')}`;
  }
}
