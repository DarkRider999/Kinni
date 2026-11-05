import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationPrefs1730800000000 implements MigrationInterface {
  name = 'AddNotificationPrefs1730800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs jsonb DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users DROP COLUMN IF EXISTS notification_prefs`,
    );
  }
}
