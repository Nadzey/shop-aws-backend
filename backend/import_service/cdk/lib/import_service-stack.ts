import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3notifications from "aws-cdk-lib/aws-s3-notifications";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import { Construct } from "constructs";

export class ImportServiceStack extends cdk.Stack {
  public readonly catalogItemsQueue: sqs.IQueue;
  public readonly createProductTopic: sns.Topic;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create S3 bucket for CSV uploads
    const importBucket = new s3.Bucket(this, "ImportBucket", {
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    this.catalogItemsQueue = sqs.Queue.fromQueueAttributes(this, "CatalogItemsQueue", {
      queueArn: "arn:aws:sqs:us-east-1:468064426767:catalogItemsQueue",
      queueUrl: "https://sqs.us-east-1.amazonaws.com/468064426767/catalogItemsQueue"
    });
        
    // Create SNS topic for product creation notifications
    this.createProductTopic = new sns.Topic(this, "CreateProductTopic", {
      topicName: "createProductTopic",
    });

    // Subscribe to SNS topic with email notifications
    this.createProductTopic.addSubscription(
      new subs.EmailSubscription("nadiakoluzaeva@gmail.com")
    );

    // IAM Role for Lambda functions
    const lambdaRole = new iam.Role(this, "LambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    lambdaRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
    );

    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
        resources: [`${importBucket.bucketArn}/*`, importBucket.bucketArn],
      })
    );

    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["sqs:SendMessage"],
        resources: ["arn:aws:sqs:us-east-1:468064426767:catalogItemsQueue"],
      })
    );    

    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["sns:Publish"],
        resources: [this.createProductTopic.topicArn],
      })
    );

    // `importProductsFile` Lambda - Generates Signed URL for CSV upload
    const importProductsFile = new lambda.Function(this, "ImportProductsFile", {
      functionName: "ImportProductsFile",
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("../lambda"),
      handler: "importProductsFile.handler",
      role: lambdaRole,
      environment: {
        BUCKET_NAME: importBucket.bucketName,
      },
    });

    // API Gateway integration for `importProductsFile`
    const api = new apigateway.RestApi(this, "ImportApi", {
      restApiName: "Import Service API",
      deployOptions: { stageName: "prod" },
    });

    const importResource = api.root.addResource("import");
    importResource.addMethod("GET", new apigateway.LambdaIntegration(importProductsFile), {
      requestParameters: {
        "method.request.querystring.name": true,
      },
    });

    // `importFileParser` Lambda - Reads CSV from S3 and sends records to SQS
    const importFileParser = new lambda.Function(this, "ImportFileParser", {
      functionName: "ImportFileParser",
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("../lambda"),
      handler: "importFileParser.handler",
      role: lambdaRole,
      environment: {
        SQS_URL: this.catalogItemsQueue.queueUrl,
      },
    });

    // S3 Event Notification - Triggers `importFileParser` when new file is uploaded
    importBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3notifications.LambdaDestination(importFileParser),
      { prefix: "uploaded/" }
    );

    // Output the API Gateway URL, SQS ARN, and SNS ARN
    new cdk.CfnOutput(this, "ImportServiceApiUrl", {
      value: api.url,
      exportName: "ImportServiceApiUrl",
    });

    new cdk.CfnOutput(this, "CatalogItemsQueueArn", {
      value: this.catalogItemsQueue.queueArn,
      exportName: "CatalogItemsQueueArn",
    });

    new cdk.CfnOutput(this, "CreateProductTopicArn", {
      value: this.createProductTopic.topicArn,
      exportName: "CreateProductTopicArn",
    });
  }
}
