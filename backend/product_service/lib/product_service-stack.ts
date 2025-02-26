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

    // Create API Gateway
    const api = new apigateway.RestApi(this, "ProductServiceAPI", {
      restApiName: "Product Service API",
    });

    // Create `/products` resource in API Gateway
    const products = api.root.addResource("products");

    // Create `/products/{productId}` resource
    const product = products.addResource("{productId}");

    // Create Lambda function for `createProduct`
    const createProductLambda = new lambda.Function(this, "createProduct", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("lambda"), // Ensure `createProduct.js` is inside `lambda/`
      handler: "createProduct.handler",
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
      },
    });

    // Grant Lambda **write** permissions
    productsTable.grantReadWriteData(createProductLambda);
    stocksTable.grantReadWriteData(createProductLambda);

    // Add `POST /products` API Gateway integration
    products.addMethod("POST", new apigateway.LambdaIntegration(createProductLambda));

    // Create Lambda function for `getProductsList`
    const getProductsListLambda = new lambda.Function(this, "getProductsList", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("lambda"),
      handler: "getProductsList.handler",
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
      },
    });

    // Create Lambda function for `getProductsById`
    const getProductsByIdLambda = new lambda.Function(this, "getProductsById", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset("lambda"),
      handler: "getProductsById.handler",
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
      },
    });

    // Grant **read** permissions
    productsTable.grantReadData(getProductsListLambda);
    productsTable.grantReadData(getProductsByIdLambda);
    stocksTable.grantReadData(getProductsListLambda);
    stocksTable.grantReadData(getProductsByIdLambda);

    // Add `GET /products` API Gateway integration
    products.addMethod("GET", new apigateway.LambdaIntegration(getProductsListLambda));

    // Add `GET /products/{productId}` API Gateway integration
    product.addMethod("GET", new apigateway.LambdaIntegration(getProductsByIdLambda));

    console.log("Successfully configured Product Service Stack!");
  }
}
