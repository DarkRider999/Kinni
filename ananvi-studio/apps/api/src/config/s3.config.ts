import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

export const createS3Client = (cfg: ConfigService): S3Client =>
  new S3Client({
    region: cfg.get('S3_REGION', 'us-east-1'),
    endpoint: cfg.get('S3_ENDPOINT'),          // MinIO or custom
    credentials: {
      accessKeyId: cfg.get('S3_ACCESS_KEY', ''),
      secretAccessKey: cfg.get('S3_SECRET_KEY', ''),
    },
    forcePathStyle: cfg.get('S3_FORCE_PATH') === 'true', // MinIO
  });
