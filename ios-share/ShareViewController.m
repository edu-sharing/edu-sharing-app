#import "ShareViewController.h"
#import <MobileCoreServices/MobileCoreServices.h>
#import "CustomTableViewCell.h"


#define SERVER @"/edu-sharing"
#define POST_SERVER [NSString stringWithFormat:@"%@%@",SERVER,@"/oauth2/token"]
#define SAMMLUNG [NSString stringWithFormat:@"%@%@",SERVER,@"/rest/collection/v1/collections/-home-/search?query=&maxItems=500&skipCount=0&sortProperties=cm:modified&sortAscending=false"]
#define PICNODEID [NSString stringWithFormat:@"%@%@",SERVER,@"/rest/node/v1/nodes/-home-/-inbox-/children?renameIfExists=true&versionComment=MAIN_FILE_UPLOAD&type=%7Bhttp%3A%2F%2Fwww.campuscontent.de%2Fmodel%2F1.0%7Dio"]


@interface ShareViewController ()

@property (strong, nonatomic) NSURLSession *session;
@property (strong, nonatomic) NSMutableDictionary *responseDict;
@property (strong, nonatomic) NSString *eduserver;
@property (strong, nonatomic) NSString *sammlungID;
@property (strong, nonatomic) NSString *urlString;
@property (strong, nonatomic) NSMutableArray *sammlungDict;
@property BOOL link;

@end

@implementation ShareViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    self.link = false;
    self.loadingSpinner.transform = CGAffineTransformMakeScale(1.5f, 1.5f);
    self.controlSpinnerView.hidden = true;
}

- (void)loadeduApp {
    if (!self.session) self.session = [NSURLSession sessionWithConfiguration:[NSURLSessionConfiguration defaultSessionConfiguration] delegate:self delegateQueue:nil];

    NSString *appDomain = [[NSBundle mainBundle] bundleIdentifier];
    [[[NSUserDefaults alloc] initWithSuiteName:@"group.edusharing"] removePersistentDomainForName:appDomain];

    NSUserDefaults *defaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.edusharing"];
    if ([defaults valueForKey:@"eduserver"]) {
        self.eduserver = [defaults valueForKey:@"eduserver"];
        if ([defaults valueForKey:@"access_token"] && [defaults valueForKey:@"refresh_token"]) {
            [self refreshtoken];
        }else{
            [self alertlogin];
        }
    }else{
        [self throwError:@"Bitte zuerst anmelden" :@"Um das Objekt in edu-sharing speichern zu können, müssen Sie einen Server auswählen und sich in der App anmelden."];
    }
}
- (void)beginRequestWithExtensionContext:(NSExtensionContext *)context {
    [super beginRequestWithExtensionContext:context];

    for (NSItemProvider* itemProvider in ((NSExtensionItem*)self.extensionContext.inputItems[0]).attachments ) {

        if([itemProvider hasItemConformingToTypeIdentifier:@"public.jpeg"]) {

            [itemProvider loadItemForTypeIdentifier:@"public.jpeg" options:nil completionHandler:^(id<NSSecureCoding> item, NSError *error) {
                if (item) {
                    dispatch_async(dispatch_get_main_queue(), ^{
                        NSData *imgData;
                        if([(NSObject*)item isKindOfClass:[NSURL class]]) {
                            imgData = [NSData dataWithContentsOfURL:(NSURL*)item];
                        }
                        if([(NSObject*)item isKindOfClass:[UIImage class]]) {
                            imgData = UIImagePNGRepresentation((UIImage*)item);
                        }
                        //NSLog(@"contentText %@",self.contentText);
                        self.imageView.image = [UIImage imageWithData:imgData];
                        self.linkLB.text = @"Bild";
                        self.link = false;
                        //self.ititleTXT.text = self.contentText;
                        [self loadeduApp];
                    });
                }
            }];
        }
        if ([itemProvider hasItemConformingToTypeIdentifier:@"public.url"]) {
            [itemProvider loadPreviewImageWithOptions:nil completionHandler:^(UIImage *image, NSError *error) {
                dispatch_async(dispatch_get_main_queue(), ^{
                    if(image){
                        self.imageView.image = image;
                    }
                });
            }];

            [itemProvider loadItemForTypeIdentifier:@"public.url" options:nil completionHandler:^(NSURL *url, NSError *error) {
                dispatch_async(dispatch_get_main_queue(), ^{
                    self.urlString = url.absoluteString;
                    self.linkLB.text = @"Link";
                    self.link = true;

                    /*
                    NSString *htmlCode = [NSString stringWithContentsOfURL:url encoding:NSASCIIStringEncoding error:nil];
                    NSRange titleOpen = [htmlCode rangeOfString:@"<title>"];
                    NSRange titleClose = [htmlCode rangeOfString:@"</title>"];
                    NSRange titleRange;
                    titleRange.location = titleOpen.location + titleOpen.length ;
                    titleRange.length = titleClose.location - titleRange.location;
                    NSString *docTitle = [htmlCode substringWithRange:titleRange];
                    self.testTextView.text = [NSString stringWithFormat:@"%@ - %@",self.urlString, docTitle];
                    */

                    UIWebView *webView = [[UIWebView alloc] initWithFrame:CGRectMake(0,0,0,0)];
                    webView.delegate = self;
                    [self.view addSubview:webView];
                    [webView loadRequest:[NSURLRequest requestWithURL:url]];
                    [self loadeduApp];
                });
            }];
        }
        //@"public.file-url"
        /*if ([itemProvider hasItemConformingToTypeIdentifier:@"public.url"]) {
            [itemProvider loadItemForTypeIdentifier:@"public.url" options:nil completionHandler:^(id<NSSecureCoding> item, NSError *error) {
                dispatch_async(dispatch_get_main_queue(), ^{
                    NSData *imgData;
                    if([(NSObject*)item isKindOfClass:[NSURL class]]) {
                        imgData = [NSData dataWithContentsOfURL:(NSURL*)item];
                        self.imageView.image = [UIImage imageWithData:imgData];
                    }
                    self.testTextView.text = imgData.description;
//                    NSDictionary *jsPreprocessingResults = jsDict[NSExtensionJavaScriptPreprocessingResultsKey];
//                    NSString *selectedText = jsPreprocessingResults[@"selection"];
//                    NSString *pageTitle = jsPreprocessingResults[@"title"];
//                    if ([selectedText length] > 0) {
//                        self.testTextView.text = selectedText;
//                    } else if ([pageTitle length] > 0) {
//                        self.testTextView.text = pageTitle;
//                    }
                });
            }];
        }*/
    }
}

- (void)webViewDidFinishLoad:(UIWebView *)webView {
    self.ititleTXT.text = [webView stringByEvaluatingJavaScriptFromString:@"document.title"];
}

- (void)viewDidAppear:(BOOL)animated {
    [super viewDidAppear:animated];
    [self minheightView];
}
- (void)viewWillDisappear:(BOOL)animated {
    [super viewWillDisappear:animated];
}

- (void)alertlogin {
    NSString* message = @"Bitte loggen Sie sich ein!";
    UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"Einen Moment noch ...!"
                                                                   message:message
                                                            preferredStyle:UIAlertControllerStyleAlert];

    UIAlertAction *okBTN = [UIAlertAction actionWithTitle:@"OK"
                                                    style:UIAlertActionStyleDefault
                                                  handler:^(UIAlertAction * action) {
                                                      UITextField *nameTXT = alert.textFields.firstObject;
                                                      UITextField *pwTXT = alert.textFields.lastObject;
                                                      [self logintoken:nameTXT.text :pwTXT.text];
                                                  }];
    UIAlertAction *cancelBTN = [UIAlertAction actionWithTitle:@"Cancel" style:UIAlertActionStyleDefault handler:nil];
    [alert addAction:okBTN];
    [alert addAction:cancelBTN];
    [alert addTextFieldWithConfigurationHandler:^(UITextField *nameTXT) {
        nameTXT.clearButtonMode = UITextFieldViewModeWhileEditing;
        nameTXT.autocapitalizationType = UITextAutocapitalizationTypeNone;
        nameTXT.borderStyle = UITextBorderStyleRoundedRect;
        nameTXT.placeholder = @"Benutzername";
    }];
    [alert addTextFieldWithConfigurationHandler:^(UITextField *pwTXT) {
        pwTXT.clearButtonMode = UITextFieldViewModeWhileEditing;
        pwTXT.autocapitalizationType = UITextAutocapitalizationTypeNone;
        pwTXT.borderStyle = UITextBorderStyleRoundedRect;
        pwTXT.secureTextEntry = true;
        pwTXT.placeholder = @"Password";
    }];
    [self presentViewController:alert animated:YES completion:nil];
}
- (void)logintoken:(NSString *)name :(NSString *)pw {  //NSLog(@"name: %@ - pw: %@ ",name, pw);
    NSString* usrPass = [NSString stringWithFormat:@"%@%@&password=%@",@"grant_type=password&client_id=eduApp&client_secret=secret&username=",name,pw];
    NSData* postData = [usrPass dataUsingEncoding:NSASCIIStringEncoding allowLossyConversion:NO];
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:[NSString stringWithFormat:@"%@%@",self.eduserver,POST_SERVER]] cachePolicy: NSURLRequestUseProtocolCachePolicy timeoutInterval:20.0];
    [request setHTTPMethod:@"POST"];
    [request setValue:[NSString stringWithFormat:@"%zd", postData.length] forHTTPHeaderField:@"Content-Length"];
    [request setValue:@"application/x-www-form-urlencoded" forHTTPHeaderField:@"Content-Type"];
    [request setValue:@"no-cache" forHTTPHeaderField:@"Cache-Control"];
    [request setHTTPBody:postData];
    [[self.session dataTaskWithRequest:request completionHandler:
      ^(NSData *data, NSURLResponse *response, NSError *error) {
          dispatch_async(dispatch_get_main_queue(), ^{
              if(error == nil) {
                  NSInteger statusCode = ((NSHTTPURLResponse *)response).statusCode;
                  if (statusCode == 200) {
                      self.responseDict = [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingAllowFragments error:nil];
                      NSUserDefaults *defaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.edusharing"];
                      [defaults setObject:[self.responseDict  valueForKey:@"access_token"] forKey:@"access_token"];
                      [defaults setObject:[self.responseDict  valueForKey:@"refresh_token"] forKey:@"refresh_token"];
                      [defaults setObject:[self.responseDict  valueForKey:@"expires_in"] forKey:@"expires_in"];
                      [defaults synchronize];
                      [self loadSammlung];
                  }else{
                      [self throwError:@"Falsche Logindaten!" :@""];
                  }
                  //[UIApplication sharedApplication].networkActivityIndicatorVisible = NO;

              }else{
                  [self throwError:@"Hinweis!" :error.description];
              }
          });
      }] resume];
}

- (void)refreshtoken {
    NSUserDefaults *defaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.edusharing"];
    NSString* usrPass = [NSString stringWithFormat:@"%@%@", @"grant_type=refresh_token&client_id=eduApp&client_secret=secret&refresh_token=",[defaults valueForKey:@"refresh_token"]];
    NSData* postData = [usrPass dataUsingEncoding:NSASCIIStringEncoding allowLossyConversion:NO];
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:[NSString stringWithFormat:@"%@%@",self.eduserver,POST_SERVER]] cachePolicy: NSURLRequestUseProtocolCachePolicy timeoutInterval:20.0];
    [request setHTTPMethod:@"POST"];
    [request setValue:[NSString stringWithFormat:@"%zd", postData.length] forHTTPHeaderField:@"Content-Length"];
    [request setValue:@"application/x-www-form-urlencoded" forHTTPHeaderField:@"Content-Type"];
    [request setValue:@"no-cache" forHTTPHeaderField:@"Cache-Control"];
    [request setHTTPBody:postData];
    [[self.session dataTaskWithRequest:request completionHandler:
      ^(NSData *data, NSURLResponse *response, NSError *error) {
          dispatch_async(dispatch_get_main_queue(), ^{
              if(error == nil) {
                  NSInteger statusCode = ((NSHTTPURLResponse *)response).statusCode;
                  if (statusCode == 200) {
                      self.responseDict = [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingAllowFragments error:nil];
                      NSUserDefaults *defaults = [[NSUserDefaults alloc] initWithSuiteName:@"group.edusharing"];
                      [defaults setObject:[self.responseDict  valueForKey:@"access_token"] forKey:@"access_token"];
                      [defaults setObject:[self.responseDict  valueForKey:@"refresh_token"] forKey:@"refresh_token"];
                      [defaults setObject:[self.responseDict  valueForKey:@"expires_in"] forKey:@"expires_in"];
                      [defaults synchronize];
                      [self loadSammlung];
                  }else{
                      [self alertlogin];
                  }
                  //[UIApplication sharedApplication].networkActivityIndicatorVisible = NO;
              }else{
                  [self throwError:@"Hinweis!" :error.description];
              }
          });
      }] resume];
}

- (void)loadSammlung {
    NSString *authorization = [NSString stringWithFormat:@"Bearer %@",[self.responseDict valueForKey:@"access_token"]];
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:[NSString stringWithFormat:@"%@%@",self.eduserver,SAMMLUNG]] cachePolicy: NSURLRequestUseProtocolCachePolicy timeoutInterval:20.0];

    [request setHTTPMethod:@"GET"];
    [request setValue:@"application/json" forHTTPHeaderField:@"Accept"];
    [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
    [request setValue:authorization forHTTPHeaderField:@"Authorization"];

    [self.loadingSpinner startAnimating];
    self.sammlungDict = [NSMutableArray new];

    [[self.session dataTaskWithRequest:request completionHandler:
      ^(NSData *data, NSURLResponse *response, NSError *error) {
          dispatch_async(dispatch_get_main_queue(), ^{
              if(error == nil) {
                  NSInteger statusCode = ((NSHTTPURLResponse *)response).statusCode;
                  if (statusCode == 200) {
                      NSDictionary *sDict = [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingAllowFragments error:nil];
                      
                      // filter only collections user is allowed to publish in
                      NSArray *collArray = [sDict valueForKey:@"collections"];
                      NSMutableArray *filteredArray = [NSMutableArray arrayWithCapacity:[collArray count]];
                      for (NSString *collection in collArray) {
                          
                          NSString *title = [collection valueForKey:@"title"];
                          NSLog(@"Collection %@",title);
                          
                          BOOL validCollection = false;
                          NSArray *accessArray = [collection valueForKey:@"access"];
                          for (NSString *access in accessArray) {
                              NSLog(@"ACCESS %@",access);
                              if ([access isEqualToString:@"Write"]) validCollection = true;
                              if ([access isEqualToString:@"CCPublish"]) validCollection = true;
                          }
                          
                          if (validCollection) [filteredArray addObject:collection];
                      }

                      for (NSString *imgData in filteredArray) {
                          NSString *tile = @"";
                          UIImage *image = nil;
                          NSString *sid = @"";
                          UIImage *imgGroup = nil;
                          if ([[[imgData valueForKey:@"preview"] valueForKey:@"isIcon"] intValue] == 1) {
                              tile = [imgData valueForKey:@"title"];
                              image = [UIImage imageNamed:@"ic_layers_48pt"];
                              sid = [[imgData valueForKey:@"ref"] valueForKey:@"id"];
                          }else{
                              tile = [imgData valueForKey:@"title"];
                              NSURL *imageURL = [NSURL URLWithString:[[imgData valueForKey:@"preview"] valueForKey:@"url"]];
                              NSData *imageData = [NSData dataWithContentsOfURL:imageURL];
                              image = [UIImage imageWithData:imageData];
                              sid = [[imgData valueForKey:@"ref"] valueForKey:@"id"];
                          }
                          if ([[imgData valueForKey:@"scope"] isEqualToString:@"CUSTOM"]) {
                              imgGroup = [UIImage imageNamed:@"shared@2x"];
                          }else if ([[imgData valueForKey:@"scope"] isEqualToString:@"EDU_ALL"]) {
                              imgGroup = [UIImage imageNamed:@"public@2x"];
                          }
                          [self.sammlungDict addObject:[NSArray arrayWithObjects:tile,image,sid,(imgGroup)?imgGroup:[NSNull null],nil]];
                      }
                      //self.testTextView.text = self.imgArray.description;
                      [self.tableView reloadData];
                      [self.loadingSpinner stopAnimating];
                  }else{
                      [self throwError:@"Hinweis!" :[NSString stringWithFormat:@"%@\nStatus-Code: %zd",@"Collection konnte nicht geladen werden",statusCode]];
                  }
              }else{
                  [self throwError:@"Hinweis!" :error.description];
              }
          });
      }] resume];
}

- (void)nodeIDinbox:(BOOL)sammlung {
    NSString *authorization = [NSString stringWithFormat:@"Bearer %@",[self.responseDict valueForKey:@"access_token"]];
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:[NSString stringWithFormat:@"%@%@",self.eduserver,PICNODEID]] cachePolicy: NSURLRequestUseProtocolCachePolicy timeoutInterval:20.0];

    NSMutableDictionary *picDict = [NSMutableDictionary dictionaryWithCapacity:1];
    if (self.link) {
        [picDict setObject:@[self.ititleTXT.text] forKey:@"cm:name"];
        [picDict setObject:@[self.ititleTXT.text] forKey:@"cm:title"];
        [picDict setObject:@[self.urlString] forKey:@"ccm:wwwurl"];
        [picDict setObject:@[] forKey:@"cclom:general_keyword"];
    }else{
        NSDateFormatter *objDateformat = [[NSDateFormatter alloc] init];
        [objDateformat setDateFormat:@"yyyyMMdd_HHmmss"];
        NSString *strTime = [NSString stringWithFormat:@"%@.jpg",[objDateformat stringFromDate:[NSDate date]]];
        [picDict setObject:@[strTime] forKey:@"cm:name"];
        [picDict setObject:@[self.ititleTXT.text] forKey:@"cm:title"];
        [picDict setObject:@[] forKey:@"cclom:general_keyword"];
    }
    NSError *jsonSerializationError = nil;
    NSData *jsonData = [NSJSONSerialization dataWithJSONObject:picDict options:NSJSONWritingPrettyPrinted error:&jsonSerializationError];

    [request setHTTPMethod:@"POST"];
    [request setValue:@"application/json" forHTTPHeaderField:@"Accept"];
    [request setValue:@"application/json" forHTTPHeaderField:@"Content-Type"];
    [request setValue:authorization forHTTPHeaderField:@"Authorization"];
    [request setHTTPBody:jsonData];

    [[self.session dataTaskWithRequest:request completionHandler:
      ^(NSData *data, NSURLResponse *response, NSError *error) {
          dispatch_async(dispatch_get_main_queue(), ^{
              if(error == nil) {
                  NSInteger statusCode = ((NSHTTPURLResponse *)response).statusCode;
                  if (statusCode == 200) {
                      NSDictionary *picnodeidDict = [NSJSONSerialization JSONObjectWithData:data options:NSJSONReadingAllowFragments error:nil];
                      NSString *picNodeID = [[[picnodeidDict valueForKey:@"node"] valueForKey:@"ref"] valueForKey:@"id"];
                      [self savePic:sammlung :picNodeID];
                  }else{
                      [self throwError:@"Hinweis!" :[NSString stringWithFormat:@"%@\nStatus-Code: %zd",@"Server - Fehler",statusCode]];
                  }
              }else{
                  [self throwError:@"Hinweis!" :error.description];
              }
          });
      }] resume];
}


//SAVE inBox
- (IBAction)saveBTN:(UIButton *)sender {
    self.saveBTN.hidden = true;
    if (sender.tag == 0) {
        [self nodeIDinbox:false];
    }else{
        [self.extensionContext completeRequestReturningItems:@[] completionHandler:nil];
    }
}

- (NSString *)generateBoundaryString {
    return [NSString stringWithFormat:@"Boundary-%@", [[NSUUID UUID] UUIDString]];
}
- (NSData *) createBodyWithBoundary:(NSString *)boundary data:(NSData*)data filename:(NSString *)filename {
    NSMutableData *body = [NSMutableData data];
    if (data) {
        [body appendData:[[NSString stringWithFormat:@"--%@\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];
        [body appendData:[[NSString stringWithFormat:@"Content-Disposition: form-data; name=\"file\"; filename=\"%@\"\r\n", filename] dataUsingEncoding:NSUTF8StringEncoding]];
        [body appendData:[[NSString stringWithFormat:@"Content-Type: %@\r\n\r\n", @"image/jpeg"] dataUsingEncoding:NSUTF8StringEncoding]];
        [body appendData:data];
        [body appendData:[@"\r\n" dataUsingEncoding:NSUTF8StringEncoding]];
    }
    [body appendData:[[NSString stringWithFormat:@"--%@--\r\n", boundary] dataUsingEncoding:NSUTF8StringEncoding]];
    return body;
}
- (void)savePic:(BOOL)sammlung :(NSString *)picNodeID {
    self.myProgress.hidden = false;
    self.controlSpinnerView.hidden = false;
    if (self.link) {
        if (sammlung) {
            NSString *authorization = [NSString stringWithFormat:@"Bearer %@",[self.responseDict valueForKey:@"access_token"]];
            NSString *firstPart = @"/rest/collection/v1/collections/-home-/";
            NSString *savepicurl = [NSString stringWithFormat:@"%@%@%@%@/references/%@",self.eduserver,SERVER,firstPart,self.sammlungID,picNodeID];

            NSMutableURLRequest *req = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:savepicurl] cachePolicy: NSURLRequestUseProtocolCachePolicy timeoutInterval:20.0];

            [req setHTTPMethod:@"PUT"];
            [req setValue:@"application/json" forHTTPHeaderField:@"Accept"];
            [req setValue:authorization forHTTPHeaderField:@"Authorization"];

            [[self.session dataTaskWithRequest:req completionHandler:
              ^(NSData *data, NSURLResponse *response, NSError *error) {
                  dispatch_async(dispatch_get_main_queue(), ^{
                      if(error == nil) {
                          NSInteger statusCode = ((NSHTTPURLResponse *)response).statusCode;
                          if (statusCode == 200) {
                              [self performSelector:@selector(removeProgressView) withObject:nil afterDelay:1.0];
                          }else{
                              NSLog(@"Status Code %zd",statusCode);
                              [self throwError:@"Hinweis!" :@"Link konnte nicht in den Sammlungen abgelegt werden"];
                          }
                      }else{
                          [self throwError:@"Hinweis!" :error.description];
                      }
                  });
              }] resume];
        }else{
            [self performSelector:@selector(removeProgressView) withObject:nil afterDelay:1.0];
        }
    }else{
        NSData *imageData = UIImageJPEGRepresentation(self.imageView.image,0.8);

        NSString *authorization = [NSString stringWithFormat:@"Bearer %@",[self.responseDict valueForKey:@"access_token"]];
        NSString *firstPart = @"/rest/node/v1/nodes/-home-/";
        NSString *lastPart = @"/content?versionComment=upload&mimetype=image%2Fjpeg";
        NSString *savepicurl = [NSString stringWithFormat:@"%@%@%@%@%@",self.eduserver,SERVER,firstPart,picNodeID,lastPart];

        NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:savepicurl] cachePolicy: NSURLRequestUseProtocolCachePolicy timeoutInterval:20.0];

        NSString *boundary = [self generateBoundaryString];
        NSString *contentType = [NSString stringWithFormat:@"multipart/form-data; boundary=%@", boundary];

        NSData *data = [self createBodyWithBoundary:boundary data:imageData filename:@"upload.jpg"];

        [request setHTTPMethod:@"POST"];
        [request setValue:@"application/json" forHTTPHeaderField:@"Accept"];
        [request setValue:contentType forHTTPHeaderField:@"Content-Type"];
        [request setValue:authorization forHTTPHeaderField:@"Authorization"];

        [[self.session uploadTaskWithRequest:request fromData:data completionHandler:
          ^(NSData *data,NSURLResponse *response,NSError *error) {
              dispatch_async(dispatch_get_main_queue(), ^{
                  if(error == nil) {
                      NSInteger statusCode = ((NSHTTPURLResponse *)response).statusCode;
                      if (statusCode == 200) {
                          if (sammlung) {
                              NSString *firstPart = @"/rest/collection/v1/collections/-home-/";
                              NSString *savepicurl = [NSString stringWithFormat:@"%@%@%@%@/references/%@",self.eduserver,SERVER,firstPart,self.sammlungID,picNodeID];

                              NSMutableURLRequest *req = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:savepicurl] cachePolicy: NSURLRequestUseProtocolCachePolicy timeoutInterval:20.0];

                              [req setHTTPMethod:@"PUT"];
                              [req setValue:@"application/json" forHTTPHeaderField:@"Accept"];
                              [req setValue:authorization forHTTPHeaderField:@"Authorization"];

                              [[self.session dataTaskWithRequest:req completionHandler:
                                ^(NSData *data, NSURLResponse *response, NSError *error) {
                                    dispatch_async(dispatch_get_main_queue(), ^{
                                        if(error == nil) {
                                            NSInteger statusCode = ((NSHTTPURLResponse *)response).statusCode;
                                            if (statusCode == 200) {

                                            }else{
                                                [self throwError:@"Hinweis!" :@"Bild konnte nicht in den Sammlungen abgelegt werden"];
                                            }
                                        }else{
                                            [self throwError:@"Hinweis!" :error.description];
                                        }
                                    });
                                }] resume];
                          }
                      }else{
                          [self throwError:@"Hinweis!" :[NSString stringWithFormat:@"%@\nStatus-Code: %zd",@"Bild konnte nicht gespeichert werden",statusCode]];
                      }
                  }else{
                      [self throwError:@"Hinweis!" :error.description];
                  }
              });
          }] resume];
    }
}



#pragma mark -
#pragma mark Session Download Delegate Methods

- (void)URLSession:(NSURLSession *)session task:(NSURLSessionTask *)task didSendBodyData:(int64_t)bytesSent totalBytesSent:(int64_t)totalBytesSent totalBytesExpectedToSend:(int64_t)totalBytesExpectedToSend {
    float progress = (double)totalBytesSent / (double)totalBytesExpectedToSend;
    dispatch_async(dispatch_get_main_queue(), ^{
        if (!self.myProgress.hidden) {
            [self.myProgress setProgress:progress animated:true];
            if (progress == 1.0) {
                [self performSelector:@selector(removeProgressView) withObject:nil afterDelay:2.0];
            }
        }
    });
}
-(void)removeProgressView {
    self.myProgress.hidden = true;
    self.myProgress.progress = 0;
    self.controlSpinnerView.hidden = true;
    UIAlertController *alert = [UIAlertController alertControllerWithTitle:@"gespeichert" message:nil preferredStyle:UIAlertControllerStyleAlert];
    [self presentViewController:alert animated:YES completion:nil];
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        [alert dismissViewControllerAnimated:YES completion:nil];
        [self.extensionContext completeRequestReturningItems:@[] completionHandler:nil];
    });
}

- (void)URLSession:(nonnull NSURLSession *)session task:(nonnull NSURLSessionTask *)task didReceiveChallenge:(nonnull NSURLAuthenticationChallenge *)challenge completionHandler:(nonnull void (^)(NSURLSessionAuthChallengeDisposition, NSURLCredential * __nullable))completionHandler {
    /*    NSURLCredential *cred = [NSURLCredential credentialWithUser:self.list[4] password:self.list[5] persistence:NSURLCredentialPersistenceForSession];
     completionHandler(NSURLSessionAuthChallengeUseCredential, cred);
     */    //oder
    NSString *authMethod = challenge.protectionSpace.authenticationMethod;
    if ([authMethod isEqualToString:NSURLAuthenticationMethodServerTrust]) {
        //NSLog(@"authMethod %@",authMethod);
        NSURLCredential *credential = [NSURLCredential credentialForTrust:challenge.protectionSpace.serverTrust];
        completionHandler(NSURLSessionAuthChallengeUseCredential,credential);
    } else {
        NSURLCredential *cred = [NSURLCredential credentialWithUser:@"admin" password:@"admin" persistence:NSURLCredentialPersistenceForSession];
        completionHandler(NSURLSessionAuthChallengeUseCredential, cred);
        //NSLog(@"Finished Challenge");
    }
}


- (void)URLSession:(NSURLSession *)session task:(NSURLSessionTask *)task didCompleteWithError:(NSError *)error {
    NSLog(@"errors %@",error.debugDescription);
    dispatch_async(dispatch_get_main_queue(), ^{
        //[UIApplication sharedApplication].networkActivityIndicatorVisible = NO;
    });
}
- (void)URLSession:(NSURLSession *)session downloadTask:(NSURLSessionDownloadTask *)downloadTask didResumeAtOffset:(int64_t)fileOffset expectedTotalBytes:(int64_t)expectedTotalBytes {
    NSLog(@"didResumeAtOffset %s", __PRETTY_FUNCTION__);
}
- (void)URLSession:(NSURLSession *)session downloadTask:(NSURLSessionDownloadTask *)downloadTask didWriteData:(int64_t)bytesWritten totalBytesWritten:(int64_t)totalBytesWritten totalBytesExpectedToWrite:(int64_t)totalBytesExpectedToWrite {
    float progress = (double)totalBytesWritten / (double)totalBytesExpectedToWrite;
    dispatch_async(dispatch_get_main_queue(), ^{
        NSLog(@"didWriteData progress %f",progress);
    });
}
- (void)URLSession:(NSURLSession *)session downloadTask:(NSURLSessionDownloadTask *)downloadTask didFinishDownloadingToURL:(NSURL *)location {
    dispatch_async(dispatch_get_main_queue(), ^{
        NSLog(@"didFinishDownloadingToURL");
    });
}

-(void)throwError:(NSString *)hinweis :(NSString *)error {
    //[UIApplication sharedApplication].networkActivityIndicatorVisible = NO;
    [self.loadingSpinner stopAnimating];
    self.controlSpinnerView.hidden = true;
    UIAlertController *alert = [UIAlertController alertControllerWithTitle:hinweis message:error preferredStyle:UIAlertControllerStyleAlert];
    UIAlertAction *okBTN = [UIAlertAction actionWithTitle:@"OK"
                                                    style:UIAlertActionStyleDefault
                                                  handler:^(UIAlertAction * action) {
                                                      if ([hinweis isEqualToString:@"Falsche Logindaten!"]) [self alertlogin];
                                                      else [self.extensionContext completeRequestReturningItems:@[] completionHandler:nil];
                                                  }];
    [alert addAction:okBTN];
    [self presentViewController:alert animated:YES completion:nil];
}


- (void)minheightView {
    if (self.contentTableView.frame.size.height < 288) {
        CGRect frame = self.contentTableView.frame;
        frame.size.height = 288;
        self.contentTableView.frame = frame;
    }else{
        CGRect frame = self.contentTableView.frame;
        frame.size.height = self.view.bounds.size.height - self.contentTableView.frame.origin.y;
        self.contentTableView.frame = frame;
    }
}
- (void)viewWillTransitionToSize:(CGSize)size withTransitionCoordinator:(id<UIViewControllerTransitionCoordinator>)coordinator {
    [coordinator animateAlongsideTransition:^(id<UIViewControllerTransitionCoordinatorContext> context) {
        [self minheightView];
    } completion:^(id<UIViewControllerTransitionCoordinatorContext> context) {
    }];
    [super viewWillTransitionToSize:size withTransitionCoordinator:coordinator];
}


#pragma mark - Table View

- (NSInteger)numberOfSectionsInTableView:(UITableView *)tableView {
    return 1;
}

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section {
    return self.sammlungDict.count;
}

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath {
    CustomTableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:@"myCell" forIndexPath:indexPath];
    cell.textLabelCustom.text = self.sammlungDict[indexPath.row][0];
    
    // Begin a new image that will be the new image with the rounded corners
    // (here with the size of an UIImageView)
    UIGraphicsBeginImageContextWithOptions(cell.imageViewCustom.bounds.size, NO, [UIScreen mainScreen].scale);
    
    // Add a clip before drawing anything, in the shape of an rounded rect
    [[UIBezierPath bezierPathWithRoundedRect:cell.imageViewCustom.bounds
                                cornerRadius:10.0] addClip];
    // Draw your image
    [self.sammlungDict[indexPath.row][1] drawInRect:cell.imageViewCustom.bounds];
    
    // Get the image, here setting the UIImageView image
    cell.imageViewCustom.image = UIGraphicsGetImageFromCurrentImageContext();
    
    // Lets forget about that we were drawing
    UIGraphicsEndImageContext();
    
    
    //cell.imageViewCustom.image = ;
    cell.imageGroup.image = nil;
    if (![self.sammlungDict[indexPath.row][3] isEqual:[NSNull null]]) cell.imageGroup.image = self.sammlungDict[indexPath.row][3];
    /*if ([[[self.sammlungDict[indexPath.row] valueForKey:@"preview"] valueForKey:@"isIcon"] intValue] == 1) {
        cell.imageViewCustom.image = [UIImage imageNamed:@"ic_layers_48pt"];
    }else{
        dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
            NSURL *imageURL = [NSURL URLWithString:[[self.sammlungDict[indexPath.row] valueForKey:@"preview"] valueForKey:@"url"]];
            NSData *imageData = [NSData dataWithContentsOfURL:imageURL];
            UIImage *image = [UIImage imageWithData:imageData];
            dispatch_async(dispatch_get_main_queue(), ^{
                cell.imageViewCustom.image = image;
            });    
        });
    }
    cell.textLabelCustom.text = [self.sammlungDict[indexPath.row] valueForKey:@"title"];*/
    return cell;
}

- (void)tableView:(UITableView *)tableView didSelectRowAtIndexPath:(NSIndexPath *)indexPath {
    self.sammlungID = self.sammlungDict[indexPath.row][2];
    self.saveBTN.hidden = true;
    [self nodeIDinbox:true];
    //NSLog(@"didSelectRowAtIndexPath: %d - %d - self.settingsList.name %@",indexPath.section,indexPath.row,self.settingsList.name);
}


@end
