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

    const importBucket = s3.Bucket.fromBucketName(
      this,
      "ImportBucket",
      "import-service-bucket-nadzeya"
    );

    this.catalogItemsQueue = sqs.Queue.fromQueueAttributes(this, "CatalogItemsQueue", {
      queueArn: "arn:aws:sqs:us-east-1:468064426767:catalogItemsQueue",
      queueUrl: "https://sqs.us-east-1.amazonaws.com/468064426767/catalogItemsQueue",
    });

    this.createProductTopic = new sns.Topic(this, "CreateProductTopic", {
      topicName: "createProductTopic",
    });

    this.createProductTopic.addSubscription(
      new subs.EmailSubscription("nadiakoluzaeva@gmail.com")
    );

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
        resources: [this.catalogItemsQueue.queueArn],
      })
    );

    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["sns:Publish"],
        resources: [this.createProductTopic.topicArn],
      })
    );

    const importProductsFile = new lambda.Function(this, "ImportProductsFile", {
      functionName: "ImportProductsFile",
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("../lambda"),
      handler: "importProductsFile.handler",
      role: lambdaRole,
      environment: {
        BUCKET_NAME: importBucket.bucketName,
        NODE_OPTIONS: "--enable-source-maps",
      },
    });

    const importFileParser = new lambda.Function(this, "ImportFileParser", {
      functionName: "ImportFileParser",
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("../lambda"),
      handler: "importFileParser.handler",
      role: lambdaRole,
      environment: {
        SQS_URL: this.catalogItemsQueue.queueUrl,
        NODE_OPTIONS: "--enable-source-maps",
      },
    });

    importBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3notifications.LambdaDestination(importFileParser),
      { prefix: "uploaded/" }
    );

    const api = new apigateway.RestApi(this, "ImportApi", {
      restApiName: "Import Service API",
      deployOptions: { stageName: "prod" },
    });

    const authorizer = new apigateway.TokenAuthorizer(this, "BasicAuthorizer", {
      handler: lambda.Function.fromFunctionArn(
        this,
        "BasicAuthorizerFunction",
        "arn:aws:lambda:us-east-1:468064426767:function:basicAuthorizer"
      ),
      identitySource: apigateway.IdentitySource.header("Authorization"),
    });

    const importResource = api.root.addResource("import");

    importResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(importProductsFile, { proxy: true }),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
        requestParameters: {
          "method.request.querystring.name": true,
        },
      }
    );

    importResource.addMethod(
      "OPTIONS",
      new apigateway.MockIntegration({
        integrationResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Headers": "'Content-Type,Authorization'",
              "method.response.header.Access-Control-Allow-Origin": "'*'",
              "method.response.header.Access-Control-Allow-Methods": "'OPTIONS,GET'",
            },
          },
        ],
        passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
        requestTemplates: {
          "application/json": '{"statusCode": 200}'
        },
      }),
      {
        methodResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Headers": true,
              "method.response.header.Access-Control-Allow-Methods": true,
              "method.response.header.Access-Control-Allow-Origin": true,
            },
          },
        ],
      }
    );

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