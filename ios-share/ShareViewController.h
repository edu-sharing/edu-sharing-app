#import <UIKit/UIKit.h>
#import <Social/Social.h>

@interface ShareViewController : UIViewController <NSXMLParserDelegate, NSURLSessionDelegate, NSURLSessionDownloadDelegate, NSURLSessionDataDelegate, NSURLSessionTaskDelegate, UITableViewDelegate,UITableViewDataSource, UIWebViewDelegate>


@property (strong, nonatomic) IBOutlet UIView *contentTableView;
@property (strong, nonatomic) IBOutlet UITableView *tableView;
@property (strong, nonatomic) IBOutlet UIImageView *imageView;
@property (strong, nonatomic) IBOutlet UILabel *linkLB;
@property (strong, nonatomic) IBOutlet UILabel *ititleTXT;
@property (strong, nonatomic) IBOutlet UIProgressView *myProgress;
@property (strong, nonatomic) IBOutlet UIActivityIndicatorView *loadingSpinner;
@property (strong, nonatomic) IBOutlet UIView *controlSpinnerView;

@property (strong, nonatomic) IBOutlet UITextView *testTextView;

@property (strong, nonatomic) IBOutlet UIButton *saveBTN;


- (IBAction)saveBTN:(UIButton *)sender;


@end
