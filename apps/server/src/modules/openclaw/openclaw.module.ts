import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BrandsModule } from "../brands/brands.module";
import { CollectorsModule } from "../collectors/collectors.module";
import { FeedbackModule } from "../feedback/feedback.module";
import { PublishingModule } from "../publishing/publishing.module";
import { ReportsModule } from "../reports/reports.module";
import { TasksModule } from "../tasks/tasks.module";
import { UserSkillsModule } from "../user-skills/user-skills.module";
import { WorksModule } from "../works/works.module";
import { OpenClawController } from "./openclaw.controller";
import { OpenClawCommentController } from "./openclaw-comment.controller";
import { OpenClawCommentLeadController } from "./openclaw-comment-lead.controller";
import { OpenClawCommentLeadService } from "./openclaw-comment-lead.service";
import { OpenClawPlatformLeadController } from "./openclaw-platform-lead.controller";
import { OpenClawPlatformLeadService } from "./openclaw-platform-lead.service";
import { OpenClawCommentService } from "./openclaw-comment.service";
import { OpenClawExplosiveAnalysisController } from "./openclaw-explosive-analysis.controller";
import { OpenClawExplosiveAnalysisService } from "./openclaw-explosive-analysis.service";
import { OpenClawCreativeMaterialController } from "./openclaw-creative-material.controller";
import { OpenClawCreativeMaterialService } from "./openclaw-creative-material.service";
import { OpenClawGeoContentController } from "./openclaw-geo-content.controller";
import { OpenClawGeoContentService } from "./openclaw-geo-content.service";
import { OpenClawDailyPlanController } from "./openclaw-daily-plan.controller";
import { OpenClawDailyPlanService } from "./openclaw-daily-plan.service";
import { OpenClawInstallationController } from "./openclaw-installation.controller";
import { OpenClawInstallationService } from "./openclaw-installation.service";
import { OpenClawGeoVisibilityReportController } from "./openclaw-geo-visibility-report.controller";
import { OpenClawGeoVisibilityReportService } from "./openclaw-geo-visibility-report.service";
import { OpenClawLobsterDiaryController } from "./openclaw-lobster-diary.controller";
import { OpenClawLobsterDiaryService } from "./openclaw-lobster-diary.service";
import { OpenClawMarketingPlanController } from "./openclaw-marketing-plan.controller";
import { OpenClawMarketingPlanService } from "./openclaw-marketing-plan.service";
import { OpenClawTencentAdLeadController } from "./openclaw-tencent-ad-lead.controller";
import { OpenClawTencentAdLeadService } from "./openclaw-tencent-ad-lead.service";
import { OpenClawCreatorCooperationController } from "./openclaw-creator-cooperation.controller";
import { OpenClawCreatorCooperationService } from "./openclaw-creator-cooperation.service";
import { OpenClawStrategyOptimizationController } from "./openclaw-strategy-optimization.controller";
import { OpenClawStrategyOptimizationService } from "./openclaw-strategy-optimization.service";
import { OpenClawThirdPartyMediaDeliveryController } from "./openclaw-third-party-media-delivery.controller";
import { OpenClawThirdPartyMediaResourceService } from "./openclaw-third-party-media-resource.service";
import { OpenClawService } from "./openclaw.service";
import { OpenClawVideoWorkController } from "./openclaw-video-work.controller";
import { OpenClawVideoWorkService } from "./openclaw-video-work.service";
import { OrdersModule } from "../orders/orders.module";
import { ThirdPartyPlatformsModule } from "../third-party-platforms/third-party-platforms.module";
import { StorageModule } from "../../storage/storage.module";
import { LocalRuntimeModule } from "../local-runtime/local-runtime.module";
import { SchedulerModule } from "../scheduler/scheduler.module";

@Module({
  imports: [AuthModule, TasksModule, BrandsModule, ReportsModule, UserSkillsModule, WorksModule, CollectorsModule, FeedbackModule, PublishingModule, ThirdPartyPlatformsModule, OrdersModule, StorageModule, LocalRuntimeModule, SchedulerModule],
  controllers: [
    OpenClawController,
    OpenClawCommentController,
    OpenClawCommentLeadController,
    OpenClawPlatformLeadController,
    OpenClawExplosiveAnalysisController,
    OpenClawInstallationController,
    OpenClawGeoVisibilityReportController,
    OpenClawGeoContentController,
    OpenClawThirdPartyMediaDeliveryController,
    OpenClawLobsterDiaryController,
    OpenClawMarketingPlanController,
    OpenClawTencentAdLeadController,
    OpenClawCreatorCooperationController,
    OpenClawStrategyOptimizationController,
    OpenClawDailyPlanController,
    OpenClawCreativeMaterialController,
    OpenClawVideoWorkController,
  ],
  providers: [
    OpenClawService,
    OpenClawCommentService,
    OpenClawCommentLeadService,
    OpenClawPlatformLeadService,
    OpenClawExplosiveAnalysisService,
    OpenClawInstallationService,
    OpenClawGeoVisibilityReportService,
    OpenClawGeoContentService,
    OpenClawThirdPartyMediaResourceService,
    OpenClawLobsterDiaryService,
    OpenClawMarketingPlanService,
    OpenClawTencentAdLeadService,
    OpenClawCreatorCooperationService,
    OpenClawStrategyOptimizationService,
    OpenClawDailyPlanService,
    OpenClawCreativeMaterialService,
    OpenClawVideoWorkService,
  ],
  exports: [
    OpenClawService,
    OpenClawCommentService,
    OpenClawCommentLeadService,
    OpenClawPlatformLeadService,
    OpenClawExplosiveAnalysisService,
    OpenClawInstallationService,
    OpenClawGeoVisibilityReportService,
    OpenClawGeoContentService,
    OpenClawThirdPartyMediaResourceService,
    OpenClawLobsterDiaryService,
    OpenClawMarketingPlanService,
    OpenClawTencentAdLeadService,
    OpenClawCreatorCooperationService,
    OpenClawStrategyOptimizationService,
    OpenClawDailyPlanService,
    OpenClawCreativeMaterialService,
    OpenClawVideoWorkService,
  ],
})
export class OpenClawModule {}
