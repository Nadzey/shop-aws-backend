import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as eventSource from "aws-cdk-lib/aws-lambda-event-sources";
import { Construct } from "constructs";

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Reference existing DynamoDB tables
    const productsTable = dynamodb.Table.fromTableName(this, "ProductsTable", "products");
    const stocksTable = dynamodb.Table.fromTableName(this, "StocksTable", "stocks");

    // Create SQS Queue for processing product batches
    const catalogItemsQueue = new sqs.Queue(this, "CatalogItemsQueue", {
      queueName: "catalogItemsQueue",
      visibilityTimeout: cdk.Duration.seconds(30),
      retentionPeriod: cdk.Duration.days(4),
    });

    // Create SNS Topic for product notifications
    const createProductTopic = new sns.Topic(this, "CreateProductTopic", {
      displayName: "Create Product Notifications",
    });

    // SNS Subscriptions with Filter Policies
    createProductTopic.addSubscription(
      new subs.EmailSubscription("koluzaeva_nadiaa@mail.ru", {
        filterPolicy: {
          price: sns.SubscriptionFilter.numericFilter({ greaterThan: 100 }),
        },
      })
    );

    createProductTopic.addSubscription(
      new subs.EmailSubscription("nadiakoluzaeva@gmail.com", {
        filterPolicy: {
          count: sns.SubscriptionFilter.numericFilter({ lessThan: 5 }),
        },
      })
    );

    // Create API Gateway with CORS enabled
    const api = new apigateway.RestApi(this, "ProductServiceAPI", {
      restApiName: "Product Service API",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Create `/products` and `/products/{productId}` API endpoints
    const products = api.root.addResource("products");
    const product = products.addResource("{productId}");

    // Create `createProduct` Lambda function
    const createProductLambda = new lambda.Function(this, "CreateProduct", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("../lambda"),
      handler: "createProduct.handler",
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
        SNS_TOPIC_ARN: createProductTopic.topicArn,
      },
    });

    // Grant permissions for Lambda to write to DynamoDB and publish to SNS
    productsTable.grantReadWriteData(createProductLambda);
    stocksTable.grantReadWriteData(createProductLambda);
    createProductTopic.grantPublish(createProductLambda);

    // Add `POST /products` API Gateway integration
    products.addMethod("POST", new apigateway.LambdaIntegration(createProductLambda));

    // Create `catalogBatchProcess` Lambda to process messages from SQS
    const catalogBatchProcessLambda = new lambda.Function(this, "CatalogBatchProcess", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("../lambda"),
      handler: "catalogBatchProcess.handler",
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
        SNS_TOPIC_ARN: createProductTopic.topicArn,
      },
    });

    // Allow Lambda to read from SQS
    catalogBatchProcessLambda.addEventSource(new eventSource.SqsEventSource(catalogItemsQueue, {
      batchSize: 5,
    }));

    // Grant permissions for Lambda to interact with DynamoDB, SQS, and SNS
    productsTable.grantReadWriteData(catalogBatchProcessLambda);
    stocksTable.grantReadWriteData(catalogBatchProcessLambda);
    catalogItemsQueue.grantConsumeMessages(catalogBatchProcessLambda);
    createProductTopic.grantPublish(catalogBatchProcessLambda);

    // Create `importFileParser` Lambda (already exists, just grant SQS permissions)
    const importFileParserLambda = new lambda.Function(this, "ImportFileParser", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("../lambda"),
      handler: "importFileParser.handler",
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: {
        SQS_URL: catalogItemsQueue.queueUrl,
      },
    });

    // Grant permissions for `importFileParser` to send messages to SQS
    catalogItemsQueue.grantSendMessages(importFileParserLambda);

    // Create `getProductsList` Lambda function
    const getProductsListLambda = new lambda.Function(this, "GetProductsList", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("../lambda"),
      handler: "getProductsList.handler",
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
      },
    });

    // Create `getProductsById` Lambda function
    const getProductsByIdLambda = new lambda.Function(this, "GetProductsById", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("../lambda"),
      handler: "getProductsById.handler",
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
      },
    });

    // Grant permissions for Lambdas to read from DynamoDB
    productsTable.grantReadData(getProductsListLambda);
    productsTable.grantReadData(getProductsByIdLambda);
    stocksTable.grantReadData(getProductsListLambda);
    stocksTable.grantReadData(getProductsByIdLambda);

    // Add `GET /products` API Gateway integration
    products.addMethod("GET", new apigateway.LambdaIntegration(getProductsListLambda));

    // Add `GET /products/{productId}` API Gateway integration
    product.addMethod("GET", new apigateway.LambdaIntegration(getProductsByIdLambda));

    console.log("Product Service Stack deployed successfully!");
    
    // Create `deleteProduct` Lambda function
    const deleteProductLambda = new lambda.Function(this, "deleteProduct", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("lambda"),
      handler: "deleteProduct.handler",
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
      },
    });
    
    productsTable.grantReadWriteData(deleteProductLambda);
    stocksTable.grantReadWriteData(deleteProductLambda);
    
    product.addMethod("DELETE", new apigateway.LambdaIntegration(deleteProductLambda));   

    // Outputs
    new cdk.CfnOutput(this, "API Gateway URL", { value: api.url });
    new cdk.CfnOutput(this, "SQS Queue URL", { value: catalogItemsQueue.queueUrl });
    new cdk.CfnOutput(this, "SNS Topic ARN", { value: createProductTopic.topicArn });
  }
}
