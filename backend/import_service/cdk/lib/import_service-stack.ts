import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3notifications from "aws-cdk-lib/aws-s3-notifications";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import { Construct } from "constructs";

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create S3 bucket with "uploaded" folder
    const importBucket = new s3.Bucket(this, "XXXXXXXXXXXX", {
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    });

    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, "SPAResponseHeadersPolicy", {
      responseHeadersPolicyName: "SPAResponseHeadersPolicy",
      comment: "Response headers policy for SPA",
      securityHeadersBehavior: {
        frameOptions: { 
          override: true,
          frameOption: cloudfront.HeadersFrameOption.DENY,
        },
        contentTypeOptions: { override: true },
        strictTransportSecurity: {
          override: true,
          accessControlMaxAge: cdk.Duration.days(365),
          includeSubdomains: true,
          preload: true,
        },
        referrerPolicy: {
          override: true,
          referrerPolicy: cloudfront.HeadersReferrerPolicy.NO_REFERRER,
        },
        xssProtection: {
          override: true,
          protection: true,
          modeBlock: true,
        },
      },
    });    

    // IAM Role for Lambda functions to interact with S3
    const lambdaS3Role = new iam.Role(this, "LambdaS3Role", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    });

    lambdaS3Role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
    );
    
    lambdaS3Role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObject", "s3:GetObject", "s3:ListBucket"],
        resources: [`${importBucket.bucketArn}/*`, importBucket.bucketArn],
      })
    );

    // Import Products File Lambda
    const importProductsFile = new lambda.Function(this, "ImportProductsFile", {
      functionName: "ImportProductsFile",
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("../lambda"),
      handler: "importProductsFile.handler",
      role: lambdaS3Role,
      environment: {
        BUCKET_NAME: importBucket.bucketName,
      },
    });
    
    // API Gateway to trigger importProductsFile Lambda
    const api = new apigateway.RestApi(this, "ImportApi", {
      restApiName: "ImportServiceApi",
      deployOptions: {
        stageName: "prod",
      },
      retainDeployments: true,
    });
    
    const importResource = api.root.addResource("import");
    importResource.addMethod("GET", new apigateway.LambdaIntegration(importProductsFile), {
      requestParameters: {
        "method.request.querystring.name": true,
      },
    });

    // Import File Parser Lambda
    const importFileParser = new lambda.Function(this, "ImportFileParser", {
      functionName: "ImportFileParser",
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("../lambda"),
      handler: "importFileParser.handler",
      role: lambdaS3Role,
    });

    // S3 Event Notification for File Parser Lambda
    importBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3notifications.LambdaDestination(importFileParser),
      { prefix: "uploaded/" }
    );

    // CloudFront Distribution for Frontend
    const distribution = new cloudfront.Distribution(this, "CloudFrontDistribution", {
      defaultBehavior: {
        origin: new origins.S3Origin(importBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: new cloudfront.CachePolicy(this, 'SPACachePolicy', {
          minTtl: cdk.Duration.seconds(0),
          maxTtl: cdk.Duration.days(365),
          defaultTtl: cdk.Duration.days(1),
          enableAcceptEncodingGzip: true,
          enableAcceptEncodingBrotli: true,
        }),
        responseHeadersPolicy: responseHeadersPolicy,
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
      comment: "Import Service CloudFront",
    });

    // Add a consistent logical ID to prevent URL changes
    const cfnDistribution = distribution.node.defaultChild as cloudfront.CfnDistribution;
    cfnDistribution.overrideLogicalId('ImportServiceDistribution');
    
    // Outputs
    new cdk.CfnOutput(this, "BucketName", { value: importBucket.bucketName });
    new cdk.CfnOutput(this, "ApiEndpoint", { value: api.url });
    new cdk.CfnOutput(this, "CloudFrontURL", { value: distribution.domainName });
  }
}
