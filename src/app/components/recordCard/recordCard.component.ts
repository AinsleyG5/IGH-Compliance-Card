// Angular
import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
// Vendor
import { EntityTypes, JobOrder } from '@bullhorn/bullhorn-types';
import * as Chart from 'chart.js';
// App
import { AppBridgeService, HttpService } from '../../services';
import { Util } from '../../util/util';
import { BullhornMeta, JobOrderResponse } from '../../interfaces/bullhorn';
import { Averages, HistoricJobCategory, JobCategory, ProbabilityScore, ProbabilityScoreInput } from '../../interfaces/examples';
import { DoughnutChartComponent } from '../../elements/doughnutChart/doughnutChart.component';
import { HistoricJobsComponent } from '../../elements/historicJobs/historicJobs.component';
import { NovoToastService, TextBoxControl, FormUtils } from 'novo-elements';
import { DateFormatPipe } from '../../date-format.pipe'

@Component({
  selector: 'app-record-card',
  templateUrl: './recordCard.component.html',
  styleUrls: ['./recordCard.component.scss'],
})
export class RecordCardComponent implements OnInit {
  // Current job data
  currentJob: JobOrder;
  jobMeta: BullhornMeta;
  candCertReqFields: string[] = ['id', 'certification', 'candidateCertificationStatus', 'owner(id,firstName,lastName)', 'candidateCertificationName'];
  roeCOFields: string[] = ['id', 'int1', 'text1','dateAdded'];
  placementFields: string[] = ['id', 'candidate', 'onboardingDocumentReceivedCount', 'onboardingDocumentSentCount', 'onboardingPercentComplete'];
  candCertReqFields2: string[] = ['id', 'candidate', 'certification', 'status'];
  creationDate: Date;
  startDate: Date;
  daysOpen: number;
  daysUntilStartDate: number;
  useStartDate: boolean;
  numSubmissions: number;
  numOpenings: number;
  onbSent: number;
  onbReceived: number;
  onbPercent: number;

  // Projected job data
  projectedStartDate: Date;
  projectedFillDate: Date;
  daysSpent: number;
  daysRemaining: number;
  score: number;
  scoreROE: number;
  scoreCategory: string;

  // Historic job data
  historicJobCategories: HistoricJobCategory[];
  averages: Averages;

  // Card declarations
  refresh: boolean = true;
  close: boolean = true;
  move: boolean = true;
  padding: boolean = true;
  empDocIcon: string = 'add-item';

  start: number = 2000;
  end: number = 2005;
  created: number = 1995;

  message: string;
  messageIcon: string;

  // Extension data
  loading = true;
  connected = true;
  errorMessage: string;
  errorDetails: string;
  isNovoEnabled = false;
  showDetails = false;

  @ViewChild(DoughnutChartComponent) doughnutChartComponent: DoughnutChartComponent;
  @ViewChild(HistoricJobsComponent) historicJobsComponent: HistoricJobsComponent;

  private readonly corpId: number;
  private readonly privateLabelId: number;
  private readonly userId: number;
  private readonly entityId: number;
  certReqItems: any = [];
  contReqItems: any = [];
  activePlacementIDs: any = [];
  noteItemsAdded: any = [];
  noteItemsAddedNoNote: any = [];
  noteItemsDQ: any = [];
  outboundCallItems: any = [];
  emailItems: any = [];
  linkedInItems: any = [];
  outboundCallsEver: number;
  emailsEver: number;
  linkedInEver: number;
  candCertReqResponse: any;
  resp: any = [];
  candCertReqCount: any;
  current: any;
  currentROE: any[];
  roeReqCount: any;
  empReqItems: any = [];
  candidateID: any = [];

  constructor(private appBridgeService: AppBridgeService,
              private httpService: HttpService,
              private route: ActivatedRoute,
              private toaster: NovoToastService,
              private formUtils: FormUtils,
              private dateFormat: DateFormatPipe) {
    // Get query string parameters passed over from Bullhorn
    this.userId = this.getBullhornId('UserID');
    this.corpId = this.getBullhornId('CorporationID');
    this.privateLabelId = this.getBullhornId('PrivateLabelID');
    this.entityId = this.getBullhornId('EntityID');
    console.log(this.route.snapshot.queryParamMap);
    this.connected = !!this.userId && !!this.corpId && !!this.privateLabelId;
    Util.setHtmlExtensionClass('custom-menu-item');
    Chart.defaults.global.defaultFontSize = 11;

  }

  ngOnInit(): void {
    if (this.connected) {
      this.appBridgeService.onRegistered.subscribe(this.onRegistered.bind(this));
      this.appBridgeService.register();
    }
  }

  toggleDetails() {
    this.showDetails = !this.showDetails;
  }

  private async onRegistered(isRegistered: any) {
    if (isRegistered) {
      this.connected = true;
      this.candidateID = await this.httpService.getEntity('Placement', this.entityId, 'id, candidate');
      this.getAllData(this.candidateID.data.candidate.id);
      this.isNovoEnabled = await this.appBridgeService.isNovoEnabled();
      if (this.isNovoEnabled) {
        document.body.className = 'zoom-out';
      }
    } else {
      this.connected = false;
      this.loading = false;
    }
  }

  /**
   * Gets details about the current job order.
   */
  // private getCurrentJobData() {
  //   this.httpService.getEntity(EntityTypes.JobOrder, this.entityId, this.jobFields.join(), 'basic').then((response: any) => {
  //     const jobOrderResponse: JobOrderResponse = response;
  //     console.log("getCurrentJobData Response: ", response);
  //     this.currentJob = jobOrderResponse.data;
  //     this.jobMeta = jobOrderResponse.meta;

  //     // Pull significant fields into individual member variables
  //     this.creationDate = new Date(Util.convertToNumber(this.currentJob.dateAdded));
  //     this.startDate = new Date(Util.convertToNumber(this.currentJob.startDate));
  //     this.numSubmissions = response.data.submissions.total;
  //     this.numOpenings = Math.min(jobOrderResponse.data.numOpenings, 1);
  //     this.getAllHistoricJobData();

  //   }).catch(this.handleError.bind(this));
  // }

  /**
   */
  private getAllData(candidateID: number): void {
    console.log(`CandidateID: `, candidateID);

    // Create search strings
    const notDeleted = `isDeleted=false`;
    const candCertReq = `candidate.id=${candidateID} AND ${notDeleted}`;
    const placeID = `placement.id=${this.entityId} AND ${notDeleted}`;
    const roeQuery = `placement.id=${this.entityId}`;

    // Construct calls
    const calls: Promise<any>[] = [];
    // calls.push(this.httpService.search(EntityTypes.CandidateCertificationRequirement, candCertReq, this.candCertReqFields.join(), 'off', 1));
    calls.push(this.httpService.search(EntityTypes.PlacementCertification, placeID, this.candCertReqFields.join(), 'off', 15));
    calls.push(this.httpService.search(EntityTypes.PlacementCustomObjectInstance8, roeQuery, this.roeCOFields.join(), 'off', 15));
    calls.push(this.httpService.search('CandidateCertificationRequirement', candCertReq, this.candCertReqFields2.join(), 'off', 15));
    calls.push(this.httpService.getEntity(EntityTypes.Placement, this.entityId, 'id, onboardingDocumentSentCount, onboardingDocumentReceivedCount, onboardingPercentComplete'));

    // Process the data received
    Promise.all(calls).then((responses: any[]) => {
      console.log("Promise.all Response: ", responses);
      this.scoreCategory = 'High';
      this.candCertReqResponse = responses[0].data;
      this.candCertReqCount = responses[0].data.length + responses[2].data.length;
      this.roeReqCount = responses[1].data.length

      this.onbSent = responses[3].data.onboardingDocumentSentCount;
      this.onbReceived = responses[3].data.onboardingDocumentReceivedCount;
      this.onbPercent = responses[3].data.onboardingPercentComplete / 100;
      console.log(`Value of Cand Cert Req: `,responses[2].data);

      this.resp.push({"title": 'Credentials and Licensure', "card": 'candidateCertReqs', "data": responses[0].data, "percent": (responses[0] / responses[0]) * 100});
      this.resp.push({"title": 'Contract Requirements', "card": 'contractReqs', "data": responses[1].data, "percent": (responses[1] / responses[1]) * 100});
      this.resp.push({"title": 'Employment Requirements', "card": 'employmentReqs', "data": responses[2].data, "percent": 0});


      const placementCurrent = this.resp[0].data.filter(this.currentCheck);
      const candidateCurrent = this.resp[2].data.filter(this.currentCheckCand);
      this.current = (placementCurrent.length > 0 || candidateCurrent > 0) ? (placementCurrent.length + candidateCurrent.length) : 0
      this.currentROE = this.resp[1].data.filter(this.currentCheckROE);
      const currentROENo = this.currentROE.length

      const scoreCheck = (this.candCertReqCount) ? (this.current / this.candCertReqCount) : 1
      console.log(`Score Check: `, scoreCheck);
      this.score =  (scoreCheck) ? scoreCheck : 0;

      const scoreCheckROE = ( currentROENo / this.roeReqCount);
      this.scoreROE = (scoreCheckROE) ? scoreCheckROE : 0
      
      this.buildItems(this.resp);
      console.log(`Build items: `, this.certReqItems);

      this.loading = false;
    }).catch(this.handleError.bind(this));
  }

  /**
   * Calculate this job's important dates and date ranges, based on creation/start/average days to fill
   */
  private calculateDatesAndRanges() {
    const dateNow = new Date();
    let date1Year = this.dateFormat.transform(dateNow, 1);
    console.log("Date1Year = ", date1Year);
  }

  private currentCheck(response: any) {
    return response.candidateCertificationStatus == 'Current';
  }

  private currentCheckCand(response: any) {
    if(response.status == 'Current' || response.status == 'Complete') {
      return true;
    }
  }

  private currentCheckROE(response: any) {
    return response.text2 != null
  }

  private buildItems(resp: any) {
    for (const obj of resp) {
      const item: any = {};
      item.icon = {};

      item.value = obj.data;
      item.percent = (obj.percent) ? obj.percent.toFixed(2) : null;
      item.info = `${obj.title}`;
      item.icon.name = (obj.percent > 15) ? 'bhi-trending-down': 'bhi-trending-up';
      item.icon.sentiment = (obj.percent > 15) ? 'negative': 'positive';

      switch(obj.card) {
        case 'candidateCertReqs':
          this.certReqItems.push(item);
          item.type = `candidate`;
          break;
        case 'contractReqs':
          this.contReqItems.push(item);
          item.type = `company`;
          break;
        case 'employmentReqs':
          this.empReqItems.push(item);
          item.type = `add-file`;
          break;
      }
    }
  }

  /**
   * Post Processing of all related jobs to calculate averages after the results are in.
   */
  private computeProbabilityScore(): void {
    this.calculateDatesAndRanges();
    const input: ProbabilityScoreInput = {
      numSubmissions: this.numSubmissions,
      daysRemaining: this.daysRemaining,
      numOpenings: this.numOpenings,
    };
    this.score = Util.computeProbabilityScore(input, this.averages).probabilityToClose;
    this.scoreCategory = Util.getProbabilityScore(this.daysSpent, this.averages);
    // this.printDebuggingInfo();
  }

  /**
   * Print debugging information in the console
   */
  // private printDebuggingInfo() {
  //   const averagesTable: any = {
  //     'Company': Util.roundForPrinting(this.historicJobCategories[JobCategory.Company].averages),
  //     'Regional': Util.roundForPrinting(this.historicJobCategories[JobCategory.Role].averages),
  //   };
  //   averagesTable.Average = Util.roundForPrinting(this.averages);
  //   console.table(averagesTable);
  //   const options = { day: 'numeric', month: 'short', year: 'numeric' };
  //   const calculationsTable: any = {
  //     daysOpen: this.daysOpen,
  //     projectedStartDate: this.projectedStartDate.toLocaleDateString('en-US', options),
  //     projectedFillDate: this.projectedFillDate.toLocaleDateString('en-US', options),
  //     daysSpent: this.daysSpent,
  //     daysRemaining: this.daysRemaining,
  //     numOpenings: this.numOpenings,
  //     numSubmissions: this.numSubmissions,
  //     score: Util.roundToPrecision(this.score, 3),
  //   };
  //   if (this.daysUntilStartDate > 0) {
  //     calculationsTable.daysUntilStartDate = this.daysUntilStartDate;
  //   }
  //   console.table(calculationsTable);
  // }

  onClose() {
    this.toaster.alert({
      theme: 'info',
      title: 'Cards',
      message: 'Close Clicked!',
    });
  }

  onRefresh() {
    this.toaster.alert({
      theme: 'success',
      title: 'Cards',
      message: 'Refresh Clicked!',
    });
  }

  private handleError(err: Error) {
    this.errorMessage = 'Cannot get record data from Bullhorn.';
    this.errorDetails = err ? err.message : `Error communicating via App Bridge`;
    this.loading = false;
  }

  private getBullhornId(param: string): number {
    return parseInt(this.route.snapshot.queryParamMap.get(param), 10);
  }
}
