import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Reference existing DynamoDB tables
    const productsTable = dynamodb.Table.fromTableName(this, "ProductsTable", "products");
    const stocksTable = dynamodb.Table.fromTableName(this, "StocksTable", "stocks");

    // Create API Gateway with CORS enabled
    const api = new apigateway.RestApi(this, "ProductServiceAPI", {
      restApiName: "Product Service API",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS, // Enable CORS
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Create `/products` and `/products/{productId}` API endpoints
    const products = api.root.addResource("products");
    const product = products.addResource("{productId}");

    // Create `createProduct` Lambda function
    const createProductLambda = new lambda.Function(this, "createProduct", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("lambda"), // Ensure `createProduct.js` is inside `lambda/`
      handler: "createProduct.handler",
      memorySize: 256, // Increased memory for handling requests
      timeout: cdk.Duration.seconds(10), // Increased timeout
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
      },
    });

    // Grant permissions for Lambda to write to DynamoDB
    productsTable.grantReadWriteData(createProductLambda);
    stocksTable.grantReadWriteData(createProductLambda);

    // Allow API Gateway to invoke `createProduct` Lambda
    createProductLambda.grantInvoke(new cdk.aws_iam.ServicePrincipal("apigateway.amazonaws.com"));

    // Add `POST /products` API Gateway integration
    products.addMethod("POST", new apigateway.LambdaIntegration(createProductLambda));

    // Create `getProductsList` Lambda function
    const getProductsListLambda = new lambda.Function(this, "getProductsList", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("lambda"),
      handler: "getProductsList.handler",
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
      },
    });

    // Create `getProductsById` Lambda function
    const getProductsByIdLambda = new lambda.Function(this, "getProductsById", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("lambda"),
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

    // Allow API Gateway to invoke `getProductsList` and `getProductsById` Lambdas
    getProductsListLambda.grantInvoke(new cdk.aws_iam.ServicePrincipal("apigateway.amazonaws.com"));
    getProductsByIdLambda.grantInvoke(new cdk.aws_iam.ServicePrincipal("apigateway.amazonaws.com"));

    // Add `GET /products` API Gateway integration
    products.addMethod("GET", new apigateway.LambdaIntegration(getProductsListLambda));

    // Add `GET /products/{productId}` API Gateway integration
    product.addMethod("GET", new apigateway.LambdaIntegration(getProductsByIdLambda));

    // Deploy API changes
    new cdk.CfnOutput(this, "API Gateway URL", {
      value: api.url,
    });

    console.log("🚀 Product Service Stack deployed successfully!");
  }
}
